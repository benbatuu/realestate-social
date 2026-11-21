import { redirect } from 'next/navigation';
import { getMe } from '@/lib/api/server';

/** Entry point: send people to the right place for their state. */
export default async function RootPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const first = me.tenants[0];
  redirect(first ? `/w/${first.slug}` : '/onboarding');
}
