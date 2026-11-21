import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

export type AuditAction =
  | 'auth.registered'
  | 'auth.logged_in'
  | 'auth.logged_out'
  | 'tenant.created'
  | 'subscription.started'
  | 'invitation.created'
  | 'invitation.accepted'
  | 'membership.created';

export interface AuditEntry {
  action: AuditAction;
  tenantId?: string | undefined;
  actorUserId?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  /** IDs and enum values only: never tokens, passwords or email addresses (§13.1). */
  metadata?: Record<string, string | number | boolean | null> | undefined;
  requestId?: string | undefined;
}

/**
 * Append-only audit trail. Always called with the transaction that performs the change, so an
 * action is recorded if and only if it happened.
 */
@Injectable()
export class AuditService {
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: entry.action,
        tenantId: entry.tenantId ?? null,
        actorUserId: entry.actorUserId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ...(entry.metadata ? { metadataJson: entry.metadata } : {}),
        requestId: entry.requestId ?? null,
      },
    });
  }
}
