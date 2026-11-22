import { z } from 'zod';
import { emailSchema, membershipRoleSchema, userSchema } from './auth';

export const SECTORS = ['REAL_ESTATE_OFFICE', 'INDEPENDENT_AGENT', 'DEVELOPER', 'OTHER'] as const;
export const TEAM_SIZE_BANDS = ['1', '2-5', '6-20', '21+'] as const;
export const REFERRAL_SOURCES = ['SEARCH', 'SOCIAL', 'REFERRAL', 'EVENT', 'OTHER'] as const;

export const createTenantRequestSchema = z.object({
  name: z.string().trim().min(2, 'Workspace adı en az 2 karakter olmalı.').max(80),
  sector: z.enum(SECTORS).optional(),
  teamSizeBand: z.enum(TEAM_SIZE_BANDS).optional(),
  referralSource: z.enum(REFERRAL_SOURCES).optional(),
  expectedVideosPerMonth: z.number().int().min(0).max(10_000).optional(),
});

/** Company profile. Every field optional; null clears it. */
export const tenantProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    legalName: z.string().trim().max(200).nullable(),
    taxOffice: z.string().trim().max(100).nullable(),
    taxNumber: z
      .string()
      .trim()
      .regex(/^\d{10,11}$/, 'Vergi numarası 10 veya 11 rakam olmalı.')
      .nullable(),
    phone: z.string().trim().max(30).nullable(),
    website: z.url().max(200).nullable(),
    addressLine: z.string().trim().max(300).nullable(),
    city: z.string().trim().max(60).nullable(),
    district: z.string().trim().max(60).nullable(),
    timezone: z.string().trim().max(60),
  })
  .partial();
export type TenantProfileUpdate = z.infer<typeof tenantProfileSchema>;

export const tenantDetailSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  legalName: z.string().nullable(),
  taxOffice: z.string().nullable(),
  taxNumber: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  timezone: z.string(),
  sector: z.string().nullable(),
  teamSizeBand: z.string().nullable(),
  expectedVideosPerMonth: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
});
export type TenantDetail = z.infer<typeof tenantDetailSchema>;

export const membershipStatusSchema = z.enum(['ACTIVE', 'DISABLED']);

export const memberSchema = z.object({
  membershipId: z.uuid(),
  role: membershipRoleSchema,
  joinedAt: z.iso.datetime(),
  /** A disabled member keeps the seat but cannot open the workspace. */
  status: membershipStatusSchema,
  user: userSchema.extend({ avatarUrl: z.url().nullable() }),
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
  priceMinor: z.number().int().nullable(),
  currency: z.string().nullable(),
  maxSeats: z.number().int(),
  usedSeats: z.number().int(),
  pendingInvitations: z.number().int(),
  monthlyCredits: z.number().int(),
  freeRegenerationAllowance: z.number().int(),
  maxWorkspaces: z.number().int(),
  maxCrmConnections: z.number().int(),
  usedCrmConnections: z.number().int(),
  retentionDays: z.number().int(),
  /** Plan features as shown on the pricing table (blueprint §4.4). */
  features: z.object({
    dualFormat: z.boolean(),
    portfolioAnalytics: z.enum(['none', 'basic', 'advanced']),
    teamReport: z.enum(['none', 'basic', 'full', 'advanced']),
    brandKits: z.number().int(),
    priorityQueue: z.boolean(),
    apiAccess: z.enum(['none', 'limited', 'advanced']),
  }),
});

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>;
export type Member = z.infer<typeof memberSchema>;
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type Entitlements = z.infer<typeof entitlementsSchema>;

export const updateMemberStatusRequestSchema = z.object({
  status: membershipStatusSchema,
});
export type UpdateMemberStatusRequest = z.infer<typeof updateMemberStatusRequestSchema>;

export const updateMemberRoleRequestSchema = z.object({
  role: invitableRoleSchema,
});
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;
