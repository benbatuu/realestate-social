/**
 * Stable error codes returned by the API as `{ code, message }`. The UI shows its own copy per
 * code; `message` is an English fallback for logs and API consumers.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'EMAIL_TAKEN',
  'SEAT_LIMIT_REACHED',
  'ALREADY_MEMBER',
  'INVITATION_PENDING',
  'INVITATION_INVALID',
  'INVITATION_EMAIL_MISMATCH',
  'ORIGIN_NOT_ALLOWED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  /** Field-level problems for VALIDATION_FAILED. */
  issues?: { path: string; message: string }[];
}

/** Header carrying the active workspace for tenant-scoped routes. */
export const TENANT_HEADER = 'x-tenant-id';
