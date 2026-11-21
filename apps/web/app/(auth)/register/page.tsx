import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/api/server';
import { safeNextPath } from '@/lib/errors';

export const metadata: Metadata = { title: 'Hesap oluştur' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath((await searchParams)['next']);
  if (await getMe()) redirect(next ?? '/');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Hesap oluştur</CardTitle>
        <CardDescription>Portföyünüz için video üretmeye birkaç adımda başlayın.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm next={next} />
      </CardContent>
    </Card>
  );
}
