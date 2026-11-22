import type { ImportStatus } from '@app/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { ErrorReportButton } from '@/components/properties/error-report-button';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { getImports } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { canEditPortfolio } from '@/lib/roles';
import { requireWorkspace } from '../../workspace';

export const metadata: Metadata = { title: 'İçe aktarma geçmişi' };

const STATUS: Record<
  ImportStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  UPLOADED: { label: 'Onay bekliyor', variant: 'outline' },
  QUEUED: { label: 'Sırada', variant: 'secondary' },
  RUNNING: { label: 'Çalışıyor', variant: 'secondary' },
  COMPLETED: { label: 'Tamamlandı', variant: 'default' },
  FAILED: { label: 'Başarısız', variant: 'destructive' },
  EXPIRED: { label: 'Süresi doldu', variant: 'outline' },
};

export default async function ImportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  if (!canEditPortfolio(tenant.role)) notFound();
  const imports = await getImports(tenant.id);
  const base = `/w/${tenant.slug}/properties`;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={base}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Portföy
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">İçe aktarma geçmişi</h1>
        <Link href={`${base}/import`} className={buttonVariants()}>
          Yeni içe aktarma
        </Link>
      </header>
      <DataTable
        label="İçe aktarmalar"
        rows={imports}
        rowKey={(i) => i.id}
        empty={
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Henüz içe aktarma yapılmadı.
          </p>
        }
        columns={[
          {
            id: 'file',
            header: 'Dosya',
            cell: (i) => (
              <div className="flex flex-col">
                <span className="font-medium">{i.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(i.createdAt)}
                  {i.createdBy ? ` · ${i.createdBy.name}` : ''}
                </span>
              </div>
            ),
          },
          {
            id: 'status',
            header: 'Durum',
            cell: (i) => <Badge variant={STATUS[i.status].variant}>{STATUS[i.status].label}</Badge>,
          },
          {
            id: 'result',
            header: 'Sonuç',
            hideBelow: 'md',
            cell: (i) => (
              <span className="text-sm text-muted-foreground tabular-nums">
                {i.status === 'COMPLETED'
                  ? `${i.created} yeni · ${i.updated} güncel · ${i.unchanged} aynı · ${i.failed} hatalı`
                  : `${i.totalRows} satır`}
              </span>
            ),
          },
          {
            id: 'actions',
            header: '',
            align: 'right',
            width: '1%',
            cell: (i) =>
              i.failed > 0 ? <ErrorReportButton tenantId={tenant.id} importId={i.id} /> : null,
          },
        ]}
      />
    </div>
  );
}
