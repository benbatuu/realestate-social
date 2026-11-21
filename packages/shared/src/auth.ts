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

export const registerRequestSchema = z.object({
  name: z.string().trim().min(2, 'Adınızı girin.').max(100),
  email: emailSchema,
  password: passwordSchema,
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

export const tenantSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  role: membershipRoleSchema,
});

export const meResponseSchema = z.object({
  user: userSchema,
  tenants: z.array(tenantSummarySchema),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type User = z.infer<typeof userSchema>;
export type TenantSummary = z.infer<typeof tenantSummarySchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
