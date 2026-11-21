import type {
  CreateInvitationRequest,
  CreateInvitationResponse,
  Invitation,
  InvitationPreview,
  TenantSummary,
} from '@app/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { generateToken, hashToken } from '../auth/crypto';
import { AppError } from '../common/http/app-error';
import type { TenantContext } from '../common/http/request-context';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { EntitlementsService } from '../entitlements/entitlements.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { hasAtLeast } from '../tenants/roles';

const DAY_MS = 24 * 60 * 60 * 1000;

type InvitationRow = Prisma.InvitationGetPayload<object>;

function toDto(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const seatLimitError = () =>
  new AppError(HttpStatus.CONFLICT, 'SEAT_LIMIT_REACHED', 'The plan has no free seats');
const invalidInvitation = () =>
  new AppError(HttpStatus.NOT_FOUND, 'INVITATION_INVALID', 'Invitation is invalid or expired');

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Serialises seat-affecting operations per tenant: invites and accepts for the same workspace
   * run one at a time, so the seat count read inside the transaction is authoritative.
   */
  private async lockTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  async create(
    tenant: TenantContext,
    inviterUserId: string,
    input: CreateInvitationRequest,
    requestId: string | undefined,
  ): Promise<CreateInvitationResponse> {
    if (!hasAtLeast(tenant.role, input.role)) {
      throw AppError.forbidden('Cannot grant a role above your own');
    }
    const token = generateToken();

    const invitation = await this.prisma.$transaction(async (tx) => {
      await this.lockTenant(tx, tenant.tenantId);

      const existingMember = await tx.membership.findFirst({
        where: { tenantId: tenant.tenantId, user: { email: input.email } },
        select: { id: true },
      });
      if (existingMember) {
        throw new AppError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', 'Already a member');
      }

      // Re-inviting the same address replaces its pending invitation (acts as "resend").
      await tx.invitation.updateMany({
        where: { tenantId: tenant.tenantId, email: input.email, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      const [limits, usage] = await Promise.all([
        this.entitlements.limits(tenant.tenantId, tx),
        this.entitlements.seatUsage(tenant.tenantId, tx),
      ]);
      if (usage.members + usage.pendingInvitations >= limits.maxSeats) throw seatLimitError();

      const created = await tx.invitation.create({
        data: {
          tenantId: tenant.tenantId,
          email: input.email,
          role: input.role,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + this.config.INVITATION_TTL_DAYS * DAY_MS),
          invitedByUserId: inviterUserId,
        },
      });
      await this.audit.record(tx, {
        action: 'invitation.created',
        tenantId: tenant.tenantId,
        actorUserId: inviterUserId,
        targetType: 'invitation',
        targetId: created.id,
        metadata: { role: created.role },
        requestId,
      });
      return created;
    });

    // The token goes in the URL fragment: browsers never send it to any server or log.
    const acceptUrl = new URL('/invite', this.config.APP_URL);
    acceptUrl.hash = `token=${token}`;
    return { invitation: toDto(invitation), acceptUrl: acceptUrl.toString() };
  }

  async listPending(tenantId: string): Promise<Invitation[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  async preview(token: string): Promise<InvitationPreview> {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { tenant: { select: { name: true, status: true } } },
    });
    if (!row || row.status === 'REVOKED' || row.tenant.status !== 'ACTIVE') {
      throw invalidInvitation();
    }
    const state =
      row.status === 'ACCEPTED' ? 'used' : row.expiresAt <= new Date() ? 'expired' : 'valid';
    return { tenantName: row.tenant.name, email: row.email, role: row.role, state };
  }

  async accept(
    userId: string,
    token: string,
    requestId: string | undefined,
  ): Promise<TenantSummary> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.invitation.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { tenant: true },
      });
      if (!row || row.status !== 'PENDING' || row.expiresAt <= new Date()) {
        throw invalidInvitation();
      }
      if (row.tenant.status !== 'ACTIVE') throw invalidInvitation();

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.email !== row.email) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          'INVITATION_EMAIL_MISMATCH',
          'This invitation was sent to a different email address',
        );
      }

      await this.lockTenant(tx, row.tenantId);

      // Conditional update: of two concurrent accepts of one token, only one can win.
      const claimed = await tx.invitation.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedByUserId: userId, acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw invalidInvitation();

      const already = await tx.membership.findUnique({
        where: { tenantId_userId: { tenantId: row.tenantId, userId } },
      });
      if (already) {
        throw new AppError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', 'Already a member');
      }

      // Re-checked under the tenant lock: plans can shrink after an invitation was sent.
      const [limits, usage] = await Promise.all([
        this.entitlements.limits(row.tenantId, tx),
        this.entitlements.seatUsage(row.tenantId, tx),
      ]);
      if (usage.members >= limits.maxSeats) throw seatLimitError();

      const membership = await tx.membership.create({
        data: { tenantId: row.tenantId, userId, role: row.role },
      });
      await this.audit.record(tx, {
        action: 'invitation.accepted',
        tenantId: row.tenantId,
        actorUserId: userId,
        targetType: 'invitation',
        targetId: row.id,
        requestId,
      });
      await this.audit.record(tx, {
        action: 'membership.created',
        tenantId: row.tenantId,
        actorUserId: userId,
        targetType: 'membership',
        targetId: membership.id,
        metadata: { role: membership.role, source: 'invitation' },
        requestId,
      });
      return { id: row.tenant.id, name: row.tenant.name, slug: row.tenant.slug, role: row.role };
    });
  }
}
