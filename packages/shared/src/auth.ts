import { z } from 'zod';

/** Lower-cases and trims so the same address always maps to one account. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Geçerli bir e-posta adresi girin.' }))
  .refine((v) => v.length <= 254, 'E-posta adresi çok uzun.');

export const passwordSchema = z
  .string()
  .min(10, 'Şifre en az 10 karakter olmalı.')
  .max(200, 'Şifre en fazla 200 karakter olabilir.');

export const LEGAL_VERSIONS = {
  TERMS: '2026-11-01',
  PRIVACY_NOTICE: '2026-11-01',
  MARKETING: '2026-11-01',
} as const;

export const registerRequestSchema = z.object({
  name: z.string().trim().min(2, 'Adınızı girin.').max(100),
  email: emailSchema,
  password: passwordSchema,
  /** Required: terms of use and the privacy notice (KVKK). */
  acceptTerms: z.literal(true, { message: 'Kullanım koşullarını kabul etmelisiniz.' }),
  /** Optional: marketing messages. Recorded either way. */
  marketingConsent: z.boolean(),
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  // Login never reveals password rules: any non-empty string is checked against the hash.
  password: z.string().min(1, 'Şifrenizi girin.').max(200),
});

export const membershipRoleSchema = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
});

export const userProfileSchema = userSchema.extend({
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  /** Short-lived link, or null when the user has no avatar. */
  avatarUrl: z.url().nullable(),
});

export const tenantSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  role: membershipRoleSchema,
  /** False when the workspace admin has paused this member. Absent in older responses: treat as active. */
  membershipActive: z.boolean().optional(),
});

export const meResponseSchema = z.object({
  user: userProfileSchema,
  tenants: z.array(tenantSummarySchema),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type User = z.infer<typeof userSchema>;
export type TenantSummary = z.infer<typeof tenantSummarySchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export const updateProfileRequestSchema = z.object({
  name: z.string().trim().min(2, 'Adınızı girin.').max(100),
  phone: z.string().trim().max(30).nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifrenizi girin.').max(200),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'Yeni şifre eskisinden farklı olmalı.',
    path: ['newPassword'],
  });
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
