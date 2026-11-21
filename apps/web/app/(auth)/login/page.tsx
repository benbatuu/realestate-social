import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/api/server';
import { safeNextPath } from '@/lib/errors';

export const metadata: Metadata = { title: 'Giriş yap' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath((await searchParams)['next']);
  if (await getMe()) redirect(next ?? '/');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Giriş yap</CardTitle>
        <CardDescription>Workspace&apos;inize devam etmek için giriş yapın.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
