import 'server-only';
import type { MeResponse, TenantSummary } from '@app/shared';
import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/api/server';

/**
 * Resolves the signed-in user and the workspace for a /w/[slug] route. Redirects anonymous
 * visitors to login; a slug the user is not a member of is a 404 (as in the API).
 */
export async function requireWorkspace(
  slug: string,
): Promise<{ me: MeResponse; tenant: TenantSummary }> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/w/${slug}`)}`);
  const tenant = me.tenants.find((t) => t.slug === slug);
  if (!tenant) notFound();
  return { me, tenant };
}
