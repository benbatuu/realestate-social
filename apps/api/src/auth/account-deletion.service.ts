import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../infra/prisma.service';
import { hashPassword } from './crypto';

/**
 * Carries out account deletions whose grace period has ended. The person is anonymised, not
 * hard-deleted: audit and billing evidence keep their references. Accounts that still own a
 * shared workspace are skipped and stay open, so the team does not lose its owner silently.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async runDue(now = new Date()): Promise<{ deleted: number; skipped: number }> {
    const due = await this.prisma.dataRequest.findMany({
      where: { kind: 'DELETE', status: 'OPEN', scheduledFor: { lte: now } },
      take: 100,
      select: { id: true, userId: true },
    });
    let deleted = 0;
    let skipped = 0;
    for (const req of due) {
      const sharedOwnership = await this.prisma.membership.findFirst({
        where: {
          userId: req.userId,
          role: 'OWNER',
          tenant: { memberships: { some: { userId: { not: req.userId } } } },
        },
        select: { id: true },
      });
      if (sharedOwnership) {
        skipped++;
        this.logger.warn({ requestId: req.id }, 'deletion skipped: owner of a shared workspace');
        continue;
      }
      await this.anonymise(req.id, req.userId);
      deleted++;
    }
    return { deleted, skipped };
  }

  private async anonymise(requestId: string, userId: string): Promise<void> {
    // Random password hash: nobody can sign in to the anonymised account.
    const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId } });
      await tx.membership.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@deleted.invalid`,
          name: 'Silinmiş kullanıcı',
          phone: null,
          jobTitle: null,
          passwordHash,
          status: 'DISABLED',
        },
      });
      await tx.dataRequest.update({
        where: { id: requestId },
        data: { status: 'DONE', completedAt: new Date() },
      });
      await this.audit.record(tx, {
        action: 'account.deleted',
        targetType: 'user',
        targetId: userId,
      });
    });
  }
}
