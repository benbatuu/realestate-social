import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// argon2id with OWASP-recommended minimums (19 MiB, 2 iterations, 1 lane).
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * A hash computed once at startup and verified against when the email is unknown, so login
 * takes the same time whether or not the account exists.
 */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

/** 256-bit URL-safe random token for sessions and invitations. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored as SHA-256: high-entropy, so no salt or slow hash is needed. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
