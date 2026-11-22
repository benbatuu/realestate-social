import {
  DELETION_GRACE_DAYS,
  LEGAL_VERSIONS,
  type AccountDeletion,
  type ChangePasswordRequest,
  type DeletionRequest,
  type LoginRequest,
  type MeResponse,
  type RegisterRequest,
  type UpdateProfileRequest,
} from '@app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../infra/storage.service';
import sharp from 'sharp';
import { AppError } from '../common/http/app-error';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { dummyPasswordHash, hashPassword, verifyPassword } from './crypto';
import { LoginThrottleService } from './login-throttle.service';
import { SessionService } from './session.service';

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly throttle: LoginThrottleService,
    private readonly storage: StorageService,
  ) {}

  async register(input: RegisterRequest, requestId: string | undefined): Promise<IssuedSession> {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, name: input.name, passwordHash },
        });
        // Consent evidence: what was shown (version) and what was chosen, with time.
        await tx.consentRecord.createMany({
          data: [
            { userId: user.id, type: 'TERMS', version: LEGAL_VERSIONS.TERMS, granted: true },
            {
              userId: user.id,
              type: 'PRIVACY_NOTICE',
              version: LEGAL_VERSIONS.PRIVACY_NOTICE,
              granted: true,
            },
            {
              userId: user.id,
              type: 'MARKETING',
              version: LEGAL_VERSIONS.MARKETING,
              granted: input.marketingConsent,
            },
          ],
        });
        const session = await this.sessions.create(tx, user.id);
        await this.audit.record(tx, {
          action: 'auth.registered',
          actorUserId: user.id,
          targetType: 'user',
          targetId: user.id,
          requestId,
        });
        return { token: session.token, expiresAt: session.expiresAt, userId: user.id };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Email is already registered');
      }
      throw err;
    }
  }

  async login(
    input: LoginRequest,
    ip: string | undefined,
    requestId: string | undefined,
  ): Promise<IssuedSession> {
    await this.throttle.assertAllowed(input.email, ip);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same work and same error whether the account is unknown, disabled or the password wrong.
    const valid = await verifyPassword(
      user?.passwordHash ?? (await dummyPasswordHash()),
      input.password,
    );
    if (!user || !valid || user.status !== 'ACTIVE') {
      await this.throttle.recordFailure(input.email, ip);
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }
    await this.throttle.reset(input.email);
    return this.prisma.$transaction(async (tx) => {
      const session = await this.sessions.create(tx, user.id);
      await this.audit.record(tx, {
        action: 'auth.logged_in',
        actorUserId: user.id,
        targetType: 'session',
        targetId: session.sessionId,
        requestId,
      });
      return { token: session.token, expiresAt: session.expiresAt, userId: user.id };
    });
  }

  async logout(userId: string, sessionId: string, requestId: string | undefined): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { id: sessionId } });
      await this.audit.record(tx, {
        action: 'auth.logged_out',
        actorUserId: userId,
        targetType: 'session',
        targetId: sessionId,
        requestId,
      });
    });
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        jobTitle: true,
        avatarStorageKey: true,
        memberships: {
          where: { tenant: { status: 'ACTIVE' } },
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            status: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarStorageKey
          ? await this.storage.signedGetUrl(user.avatarStorageKey)
          : null,
      },
      tenants: user.memberships.map((m) => ({
        ...m.tenant,
        role: m.role,
        membershipActive: m.status === 'ACTIVE',
      })),
    };
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<MeResponse> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      },
    });
    return this.me(userId);
  }

  /** Everything the platform holds about this user, as data (KVKK access right). */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        jobTitle: true,
        createdAt: true,
        memberships: {
          select: { role: true, createdAt: true, tenant: { select: { name: true, slug: true } } },
        },
        consents: {
          select: { type: true, version: true, granted: true, acceptedAt: true },
          orderBy: { acceptedAt: 'asc' },
        },
        dataRequests: { select: { kind: true, status: true, createdAt: true, completedAt: true } },
      },
    });
    await this.prisma.dataRequest.create({
      data: { userId, kind: 'EXPORT', status: 'DONE', completedAt: new Date() },
    });
    return { exportedAt: new Date().toISOString(), profile: user };
  }

  /**
   * Starts the grace period. The account keeps working (credits too) until `scheduledFor`.
   * A second request while one is open returns the open one.
   */
  async requestDeletion(
    userId: string,
    input: DeletionRequest,
    requestId: string | undefined,
  ): Promise<AccountDeletion> {
    const open = await this.prisma.dataRequest.findFirst({
      where: { userId, kind: 'DELETE', status: 'OPEN' },
    });
    if (open) return this.toDeletion(open);
    const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 3600 * 1000);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dataRequest.create({
        data: {
          userId,
          kind: 'DELETE',
          reason: input.reason,
          reasonDetail: input.reasonDetail ?? null,
          scheduledFor,
        },
      });
      await this.audit.record(tx, {
        action: 'account.deletion_requested',
        actorUserId: userId,
        targetType: 'data_request',
        targetId: created.id,
        metadata: { reason: input.reason, graceDays: DELETION_GRACE_DAYS },
        requestId,
      });
      return created;
    });
    return this.toDeletion(row);
  }

  async openDeletion(userId: string): Promise<AccountDeletion | null> {
    const open = await this.prisma.dataRequest.findFirst({
      where: { userId, kind: 'DELETE', status: 'OPEN' },
    });
    return open ? this.toDeletion(open) : null;
  }

  async cancelDeletion(userId: string, id: string, requestId: string | undefined): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.dataRequest.updateMany({
        where: { id, userId, kind: 'DELETE', status: 'OPEN' },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
      if (moved.count !== 1) throw AppError.notFound('Deletion request not found');
      await this.audit.record(tx, {
        action: 'account.deletion_cancelled',
        actorUserId: userId,
        targetType: 'data_request',
        targetId: id,
        requestId,
      });
    });
  }

  private toDeletion(row: {
    id: string;
    status: string;
    reason: string | null;
    createdAt: Date;
    scheduledFor: Date | null;
  }): AccountDeletion {
    return {
      id: row.id,
      status: row.status as AccountDeletion['status'],
      reason: (row.reason as AccountDeletion['reason']) ?? null,
      requestedAt: row.createdAt.toISOString(),
      scheduledFor: (row.scheduledFor ?? row.createdAt).toISOString(),
    };
  }

  /** Checks the current password, sets the new one, and signs out every other session. */
  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordRequest,
    requestId: string | undefined,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_CREDENTIALS', 'Mevcut şifre hatalı.');
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId, id: { not: sessionId } } });
      await this.audit.record(tx, {
        action: 'auth.password_changed',
        actorUserId: userId,
        targetType: 'user',
        targetId: userId,
        requestId,
      });
    });
  }

  /** Validates by content, crops to a 256 px square WebP, stores it, replaces any old avatar. */
  async setAvatar(userId: string, buffer: Buffer): Promise<MeResponse> {
    let out: Buffer;
    try {
      const meta = await sharp(buffer, { limitInputPixels: 50_000_000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '')) {
        throw new AppError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'FILE_UNSUPPORTED',
          'Yalnızca JPEG, PNG veya WebP yüklenebilir.',
        );
      }
      out = await sharp(buffer, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'FILE_UNSUPPORTED', 'Görsel okunamadı.');
    }
    const key = `avatars/${userId}/${Date.now()}.webp`;
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarStorageKey: true },
    });
    await this.storage.put(key, out, 'image/webp');
    await this.prisma.user.update({ where: { id: userId }, data: { avatarStorageKey: key } });
    if (previous.avatarStorageKey)
      await this.storage.delete([previous.avatarStorageKey]).catch(() => undefined);
    return this.me(userId);
  }

  async removeAvatar(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarStorageKey: true },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarStorageKey: null } });
    if (user.avatarStorageKey)
      await this.storage.delete([user.avatarStorageKey]).catch(() => undefined);
    return this.me(userId);
  }
}
