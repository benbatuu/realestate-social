import { randomBytes } from 'node:crypto';

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** URL slug from a workspace name plus a random suffix, so names need not be unique. */
export function makeSlug(name: string): string {
  const base = name
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  const suffix = randomBytes(4).toString('hex').slice(0, 6);
  return `${base || 'workspace'}-${suffix}`;
}
