import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlanCard } from '@/components/app/plan-card';
import { PackageSection } from '@/components/billing/package-section';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCredits, getEntitlements } from '@/lib/api/server';
import { canImport } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Faturalandırma' };

export default async function BillingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  if (!canImport(tenant.role)) notFound();
  const [entitlements, credits] = await Promise.all([
    getEntitlements(tenant.id),
    getCredits(tenant.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Faturalandırma</h1>
        <p className="text-sm text-muted-foreground">Paketiniz, kredileriniz ve geçmiş.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard entitlements={entitlements} credits={credits} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bu dönem</CardTitle>
            <CardDescription>
              {credits.periodEnd
                ? `Dönem sonu: ${new Date(credits.periodEnd).toLocaleDateString('tr-TR')}. Kalan kredi ve ücretsiz üretim dönem sonunda sıfırlanır.`
                : 'Aktif paket yok.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              Kredi: <span className="font-semibold tabular-nums">{credits.credits.available}</span>
              <span className="text-muted-foreground"> / {credits.credits.monthly}</span>
            </p>
            <p>
              Ücretsiz üretim:{' '}
              <span className="font-semibold tabular-nums">
                {credits.freeRegenerations.available}
              </span>
              <span className="text-muted-foreground"> / {credits.freeRegenerations.granted}</span>
            </p>
            <Link
              href={`/w/${tenant.slug}/credits`}
              className={buttonVariants({ variant: 'outline', className: 'w-fit' })}
            >
              Kredi geçmişi
            </Link>
          </CardContent>
        </Card>
      </div>

      <PackageSection tenantId={tenant.id} isOwner={tenant.role === 'OWNER'} />
    </div>
  );
}
