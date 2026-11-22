import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { AuditDetailButton } from '@/components/audit/audit-detail-button';
import { AuditFilters } from '@/components/audit/audit-filters';
import { DataTable } from '@/components/ui/data-table';
import { getAudit, getMembers } from '@/lib/api/server';
import { auditDetail, auditLabel, leadPredicate } from '@/lib/audit-labels';
import { formatDateTime } from '@/lib/format';
import { canManageMembers } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Denetim kayıtları' };

const PAGE_SIZES = ['10', '25', '50', '100'];
const CATEGORIES = [
  'all',
  'leads',
  'properties',
  'videos',
  'imports',
  'team',
  'billing',
  'account',
] as const;
type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireWorkspace(slug);
  if (!canManageMembers(tenant.role)) notFound();

  const page = Math.max(1, Number(one(sp['page']) ?? 1) || 1);
  const pageSizeParam = one(sp['pageSize']) ?? '25';
  const pageSize = PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : '25';
  const q = one(sp['q'])?.trim().slice(0, 100) ?? '';
  const categoryParam = one(sp['category']) ?? 'all';
  const category = (CATEGORIES as readonly string[]).includes(categoryParam)
    ? (categoryParam as (typeof CATEGORIES)[number])
    : 'all';
  const actorParam = one(sp['actorUserId']) ?? '';
  const actorUserId = UUID.test(actorParam) ? actorParam : '';
  const fromParam = one(sp['from']) ?? '';
  const from = DATE.test(fromParam) ? fromParam : '';
  const toParam = one(sp['to']) ?? '';
  const to = DATE.test(toParam) ? toParam : '';

  const [audit, members] = await Promise.all([
    getAudit(tenant.id, {
      page,
      pageSize: Number(pageSize),
      q: q || undefined,
      category: category === 'all' ? undefined : category,
      actorUserId: actorUserId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    getMembers(tenant.id),
  ]);

  const pageHref = (n: number, size: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (category !== 'all') p.set('category', category);
    if (actorUserId) p.set('actorUserId', actorUserId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (size !== '25') p.set('pageSize', size);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `/w/${tenant.slug}/audit?${s}` : `/w/${tenant.slug}/audit`;
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/w/${tenant.slug}/settings`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Ayarlar
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Denetim kayıtları</h1>
        <p className="text-sm text-muted-foreground">
          Workspace içinde kimin neyi, ne zaman yaptığının kaydı.
        </p>
      </header>

      <DataTable
        label="Denetim kayıtları"
        rows={audit.items}
        rowKey={(r) => r.id}
        toolbar={
          <AuditFilters
            q={q}
            category={category}
            actorUserId={actorUserId}
            from={from}
            to={to}
            members={members}
          />
        }
        pagination={{
          page,
          pageSize,
          total: audit.total,
          pageSizes: PAGE_SIZES,
          defaultPageSize: '25',
          unit: 'kayıt',
          pageHref,
        }}
        columns={[
          {
            id: 'date',
            header: 'Tarih',
            cell: (r) => (
              <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                {formatDateTime(r.createdAt)}
              </span>
            ),
          },
          { id: 'who', header: 'Kim', cell: (r) => r.actorName ?? 'Sistem' },
          {
            id: 'what',
            header: 'Ne yaptı',
            cell: (r) =>
              r.subjectId && leadPredicate(r.action) ? (
                <span className="font-medium">
                  <Link
                    href={`/w/${slug}/leads/${r.subjectId}`}
                    className="text-amber-600 hover:underline"
                  >
                    {r.subject}
                  </Link>{' '}
                  <span className="font-normal text-muted-foreground">
                    {leadPredicate(r.action)}
                  </span>
                </span>
              ) : (
                <span className="font-medium">
                  {auditLabel(r.action)}
                  {r.subject && (
                    <span className="font-normal text-muted-foreground"> · {r.subject}</span>
                  )}
                </span>
              ),
          },
          {
            id: 'detail',
            header: 'Kısa bilgi',
            hideBelow: 'md',
            cell: (r) => (
              <span className="block max-w-xs truncate text-sm text-muted-foreground">
                {auditDetail(r.metadata) || '—'}
              </span>
            ),
          },
          {
            id: 'open',
            header: '',
            align: 'right',
            width: '1%',
            cell: (r) => <AuditDetailButton item={r} slug={slug} />,
          },
        ]}
      />
    </div>
  );
}
