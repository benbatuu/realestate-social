import { PRODUCT_DISPLAY_NAME } from '@app/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateWorkspaceForm } from '@/components/app/create-workspace-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Workspace oluştur' };

export default async function OnboardingPage() {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent('/onboarding')}`);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <p className="text-sm font-medium tracking-tight text-muted-foreground">
        {PRODUCT_DISPLAY_NAME}
      </p>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Workspace oluşturun</CardTitle>
          <CardDescription>
            Portföyünüz, ekibiniz ve videolarınız bu workspace altında toplanır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm />
        </CardContent>
      </Card>
      {me.tenants.length > 0 && (
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Mevcut workspace&apos;e dön
        </Link>
      )}
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Bir ekibe katılmak için davet linkini kullanın; ayrı bir workspace oluşturmanıza gerek yok.
      </p>
    </main>
  );
}
