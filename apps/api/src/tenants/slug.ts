import { randomBytes } from 'node:crypto';

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** The readable part of a workspace URL, from its name. */
export function slugBase(name: string): string {
  const base = name
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || 'workspace';
}

/**
 * URL slug from a workspace name. The first try is the plain name; only when that is taken
 * does a later try add a short random suffix, so names need not be unique.
 */
export function makeSlug(name: string, attempt = 2): string {
  const base = slugBase(name);
  if (attempt <= 1) return base;
  return `${base}-${randomBytes(4).toString('hex').slice(0, 6)}`;
}
