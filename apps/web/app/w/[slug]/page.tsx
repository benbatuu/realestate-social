import type { Metadata } from 'next';
import Link from 'next/link';
import { PlanCard } from '@/components/app/plan-card';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getEntitlements } from '@/lib/api/server';
import { canManageMembers } from '@/lib/roles';
import { requireWorkspace } from './workspace';

export const metadata: Metadata = { title: 'Genel bakış' };

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me, tenant } = await requireWorkspace(slug);
  const entitlements = await getEntitlements(tenant.id);
  const firstName = me.user.name.split(/\s+/)[0] ?? me.user.name;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Merhaba, {firstName}</h1>
        <p className="text-sm text-muted-foreground">{tenant.name}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portföy</CardTitle>
            <CardDescription>
              Portföy içe aktarma ve video üretimi sonraki adımlarda burada olacak.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Henüz portföy verisi yok.
          </CardContent>
        </Card>
        <PlanCard entitlements={entitlements} />
      </div>

      {canManageMembers(tenant.role) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ekibinizi davet edin</CardTitle>
            <CardDescription>Danışmanlarınız aynı portföy ve videolarla çalışsın.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/w/${tenant.slug}/team`}
              className={buttonVariants({ variant: 'outline' })}
            >
              Ekibi yönet
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
