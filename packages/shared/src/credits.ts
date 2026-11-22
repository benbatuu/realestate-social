import { z } from 'zod';

export const billingTypeSchema = z.enum([
  'INITIAL_CREDIT',
  'FREE_REGENERATION',
  'PAID_REGENERATION',
]);
export type BillingType = z.infer<typeof billingTypeSchema>;

export const creditBalanceSchema = z.object({
  planCode: z.string().nullable(),
  periodStart: z.iso.datetime().nullable(),
  periodEnd: z.iso.datetime().nullable(),
  credits: z.object({
    monthly: z.number().int(),
    available: z.number().int(),
    reserved: z.number().int(),
  }),
  freeRegenerations: z.object({
    granted: z.number().int(),
    available: z.number().int(),
    reserved: z.number().int(),
    consumed: z.number().int(),
  }),
});
export type CreditBalance = z.infer<typeof creditBalanceSchema>;

export const creditLedgerEntrySchema = z.object({
  id: z.uuid(),
  type: z.enum(['GRANT', 'RESERVE', 'RELEASE', 'CAPTURE', 'EXPIRE', 'ADMIN_ADJUSTMENT']),
  amount: z.number().int(),
  referenceType: z.string().nullable(),
  referenceId: z.uuid().nullable(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type CreditLedgerEntry = z.infer<typeof creditLedgerEntrySchema>;

export const creditLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type CreditLedgerQuery = z.infer<typeof creditLedgerQuerySchema>;

export const creditLedgerResponseSchema = z.object({
  items: z.array(creditLedgerEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type CreditLedgerResponse = z.infer<typeof creditLedgerResponseSchema>;

/** Owner-only manual correction. Reason is required and stored with the ledger row. */
export const creditAdjustmentRequestSchema = z.object({
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, 'Düzeltme sıfır olamaz.')
    .refine((n) => Math.abs(n) <= 10_000, 'Tek düzeltme en fazla 10.000 olabilir.'),
  reason: z.string().trim().min(3, 'Gerekçe en az 3 karakter olmalı.').max(200),
});
export type CreditAdjustmentRequest = z.infer<typeof creditAdjustmentRequestSchema>;
