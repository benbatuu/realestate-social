import { z } from 'zod';
import { emailSchema, membershipRoleSchema, userSchema } from './auth';

export const createTenantRequestSchema = z.object({
  name: z.string().trim().min(2, 'Workspace adı en az 2 karakter olmalı.').max(80),
});

export const memberSchema = z.object({
  membershipId: z.uuid(),
  role: membershipRoleSchema,
  joinedAt: z.iso.datetime(),
  user: userSchema,
});

/** Roles an inviter may grant. OWNER is never granted by invitation. */
export const invitableRoleSchema = membershipRoleSchema.exclude(['OWNER']);

export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  role: invitableRoleSchema,
});

export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: membershipRoleSchema,
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED']),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const createInvitationResponseSchema = z.object({
  invitation: invitationSchema,
  /**
   * Accept link for the invitee. There is no email delivery yet (mock delivery): the inviter
   * shares this link. Returned once; only a hash of the token is stored.
   */
  acceptUrl: z.url(),
});

/** Tokens travel in request bodies, never in API paths, so they never reach request logs. */
export const invitationTokenRequestSchema = z.object({
  token: z.string().min(20).max(200),
});

export const invitationPreviewSchema = z.object({
  tenantName: z.string(),
  email: z.string(),
  role: membershipRoleSchema,
  state: z.enum(['valid', 'expired', 'used']),
});

export const entitlementsSchema = z.object({
  planCode: z.string().nullable(),
  planName: z.string().nullable(),
  maxSeats: z.number().int(),
  usedSeats: z.number().int(),
  pendingInvitations: z.number().int(),
});

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>;
export type Member = z.infer<typeof memberSchema>;
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type Entitlements = z.infer<typeof entitlementsSchema>;
