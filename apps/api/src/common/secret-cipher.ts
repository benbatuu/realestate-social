import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for connection secrets. The key comes from INTEGRATION_ENCRYPTION_KEY and is
 * hashed to 32 bytes. Output: base64(iv):base64(authTag):base64(ciphertext).
 */
function key(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be set (at least 32 characters).');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join(':');
}

export function decryptSecret(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split(':');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Encrypted secret has an invalid format.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
