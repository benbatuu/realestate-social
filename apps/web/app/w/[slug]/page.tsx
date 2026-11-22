import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Building2Icon,
  CreditCardIcon,
  FilmIcon,
  HistoryIcon,
  ImageIcon,
  TriangleAlertIcon,
  UploadIcon,
  UsersIcon,
  ChevronRightIcon,
  type LucideIcon,
} from 'lucide-react';
import { PlanCard } from '@/components/app/plan-card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getCredits,
  getEntitlements,
  getMembers,
  getRecentVideos,
  getStats,
} from '@/lib/api/server';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { auditLabel, leadPredicate } from '@/lib/audit-labels';
import { ROLE_LABELS } from '@/lib/roles';
import { formatDateTime } from '@/lib/format';
import { canEditPhotos, canEditPortfolio, canImport, canManageMembers } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { requireWorkspace } from './workspace';

export const metadata: Metadata = { title: 'Genel bakış' };

function Kpi({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string | undefined;
  icon: LucideIcon;
  tone?: 'default' | 'warn';
}) {
  const body = (
    <Card className={cn('h-full transition-shadow', href && 'hover:shadow-md')}>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
          {hint && (
            <span
              className={cn(
                'text-xs',
                tone === 'warn' ? 'text-amber-700' : 'text-muted-foreground',
              )}
            >
              {hint}
            </span>
          )}
        </div>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            tone === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me, tenant } = await requireWorkspace(slug);
  const [entitlements, stats, recent, credits, members] = await Promise.all([
    getEntitlements(tenant.id),
    getStats(tenant.id),
    getRecentVideos(tenant.id, 4),
    getCredits(tenant.id),
    getMembers(tenant.id),
  ]);
  const firstName = me.user.name.split(/\s+/)[0] ?? me.user.name;
  const manager = canImport(tenant.role);
  const portfolioEditor = canEditPortfolio(tenant.role);
  const base = `/w/${tenant.slug}`;
  const attention: { text: string; href: string; count: number }[] = [
    ...(stats.propertiesWithoutPhotos > 0
      ? [
          {
            text: 'Fotoğrafı olmayan mülk var',
            href: `${base}/properties`,
            count: stats.propertiesWithoutPhotos,
          },
        ]
      : []),
    ...(stats.importsPending > 0 && portfolioEditor
      ? [
          {
            text: 'Bekleyen içe aktarma',
            href: `${base}/properties/imports`,
            count: stats.importsPending,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Merhaba, {firstName}</h1>
          <p className="text-sm text-muted-foreground">{tenant.name} · bugün ekibinizin durumu</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {portfolioEditor && (
            <Link
              href={`${base}/properties/import`}
              className={buttonVariants({ variant: 'outline' })}
            >
              <UploadIcon aria-hidden />
              Portföy içe aktar
            </Link>
          )}
          <Link href={`${base}/properties`} className={buttonVariants()}>
            <Building2Icon aria-hidden />
            Portföye git
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Özet">
        <Kpi
          label="Mülk"
          value={String(stats.properties)}
          href={`${base}/properties`}
          icon={Building2Icon}
        />
        <Kpi
          label="Bu ayki video"
          value={String(stats.videosThisMonth)}
          href={`${base}/videos`}
          icon={FilmIcon}
        />
        <Kpi
          label="Kalan kredi"
          value={String(stats.credits)}
          hint={`${stats.freeRegenerations} ücretsiz yeniden üretim`}
          href={`${base}/credits`}
          icon={CreditCardIcon}
        />
        <Kpi
          label="Fotoğrafsız mülk"
          value={String(stats.propertiesWithoutPhotos)}
          hint={stats.propertiesWithoutPhotos > 0 ? 'Video için foto gerekir' : 'Hepsinde foto var'}
          href={`${base}/properties`}
          icon={ImageIcon}
          tone={stats.propertiesWithoutPhotos > 0 ? 'warn' : 'default'}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">Son videolar</CardTitle>
                <CardDescription>En yeni tamamlanan videolar.</CardDescription>
              </div>
              <Link
                href={`${base}/videos`}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Tümü
                <ChevronRightIcon className="size-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent>
              {recent.items.length === 0 ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Henüz video yok. Bir mülkten video üretince burada görünür.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {recent.items.map((v) => (
                    <li key={v.generationId}>
                      <Link href={`${base}/videos`} className="group flex flex-col gap-2">
                        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                          {v.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- signed URL
                            <img
                              src={v.thumbnailUrl}
                              alt=""
                              className="size-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <FilmIcon className="size-5" aria-hidden />
                            </div>
                          )}
                          {v.isMock && (
                            <span className="absolute top-2 right-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                              Taslak
                            </span>
                          )}
                        </div>
                        <span className="truncate text-sm font-medium">{v.propertyTitle}</span>
                        <span className="text-xs text-muted-foreground">
                          {v.completedAt ? formatDateTime(v.completedAt) : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {canEditPhotos(tenant.role) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HistoryIcon className="size-4" aria-hidden />
                  Son hareketler
                </CardTitle>
                <CardDescription>Workspace’te yakın zamanda yapılan işler.</CardDescription>
                {canManageMembers(tenant.role) && (
                  <CardAction>
                    <Link
                      href={`${base}/audit`}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Tümü
                      <ChevronRightIcon className="size-4" aria-hidden />
                    </Link>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                {stats.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz hareket yok.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {stats.recentActivity.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                        <span className="min-w-0">
                          <span className="font-medium">{a.actorName ?? 'Sistem'}</span>{' '}
                          <span className="text-muted-foreground">
                            {a.subjectId && leadPredicate(a.action) ? (
                              <>
                                <Link
                                  href={`/w/${slug}/leads/${a.subjectId}`}
                                  className="font-medium text-amber-600"
                                >
                                  {a.subject}
                                </Link>{' '}
                                {leadPredicate(a.action)}
                              </>
                            ) : a.action === 'property.photo_added' && a.propertyTitle ? (
                              `${a.propertyTitle} mülküne ${a.count} fotoğraf ekledi`
                            ) : a.action === 'video.generation_started' && a.propertyTitle ? (
                              `${a.propertyTitle} için video üretti`
                            ) : (
                              auditLabel(a.action)
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(a.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TriangleAlertIcon className="size-4" aria-hidden />
                Dikkat gerektirenler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Şu an bekleyen bir iş yok.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {attention.map((a) => (
                    <li key={a.text}>
                      <Link
                        href={a.href}
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-accent"
                      >
                        <span>{a.text}</span>
                        <Badge variant="secondary">{a.count}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {manager && <PlanCard entitlements={entitlements} credits={credits} />}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UsersIcon className="size-4" aria-hidden />
                  Ekip
                </CardTitle>
                <CardDescription>
                  {members.length} üye · {entitlements.usedSeats} / {entitlements.maxSeats} koltuk
                </CardDescription>
              </div>
              {manager && (
                <Link
                  href={`${base}/team`}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Yönet
                </Link>
              )}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {members.slice(0, 6).map((m) => (
                  <li key={m.membershipId} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {m.user.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt="" />}
                      <AvatarFallback>{initials(m.user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{m.user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{m.user.email}</span>
                    </div>
                    <Badge variant={m.role === 'OWNER' ? 'default' : 'secondary'}>
                      {ROLE_LABELS[m.role]}
                    </Badge>
                  </li>
                ))}
              </ul>
              {members.length > 6 && (
                <Link
                  href={`${base}/team`}
                  className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  +{members.length - 6} üye daha
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
