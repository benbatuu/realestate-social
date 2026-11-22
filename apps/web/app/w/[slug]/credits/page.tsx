import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { getLedger } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { canImport } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Kredi geçmişi' };

const TYPE_LABEL: Record<string, string> = {
  GRANT: 'Dönem kredisi',
  RESERVE: 'Üretim için ayrıldı',
  RELEASE: 'İade',
  CAPTURE: 'Üretim tamamlandı',
  EXPIRE: 'Süre doldu',
  ADMIN_ADJUSTMENT: 'Düzeltme',
};

export default async function CreditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  if (!canImport(tenant.role)) notFound();
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const ledger = await getLedger(tenant.id, page);
  const base = `/w/${tenant.slug}/credits`;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/w/${tenant.slug}/billing`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Faturalandırma
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Kredi geçmişi</h1>
        <p className="text-sm text-muted-foreground">
          Her kredi hareketi burada. Kayıtlar silinmez.
        </p>
      </header>

      <DataTable
        label="Kredi hareketleri"
        rows={ledger.items}
        rowKey={(e) => e.id}
        empty={
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Henüz hareket yok.
          </p>
        }
        pagination={{
          page,
          pageSize: '25',
          total: ledger.total,
          unit: 'hareket',
          pageHref: (n) => `${base}?page=${n}`,
        }}
        columns={[
          {
            id: 'date',
            header: 'Tarih',
            cell: (e) => (
              <span className="text-muted-foreground tabular-nums">
                {formatDateTime(e.createdAt)}
              </span>
            ),
          },
          {
            id: 'type',
            header: 'Tür',
            cell: (e) => <Badge variant="outline">{TYPE_LABEL[e.type] ?? e.type}</Badge>,
          },
          {
            id: 'description',
            header: 'Açıklama',
            cell: (e) => (
              <span className="text-sm text-muted-foreground">{e.description ?? '—'}</span>
            ),
          },
          {
            id: 'amount',
            header: 'Kredi',
            align: 'right',
            cell: (e) => (
              <span
                className={cn(
                  'font-medium tabular-nums',
                  e.amount > 0 && 'text-emerald-700',
                  e.amount < 0 && 'text-red-700',
                )}
              >
                {e.amount > 0 ? `+${e.amount}` : e.amount}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
