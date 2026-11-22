import type { Metadata } from 'next';
import Link from 'next/link';
import { HistoryIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { CoverageBadge } from '@/components/properties/coverage-badge';
import { CsvExportButton } from '@/components/properties/csv-export-button';
import { PropertyFilters } from '@/components/properties/property-filters';
import { PropertyThumb } from '@/components/properties/property-thumb';
import { buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { getProperties } from '@/lib/api/server';
import { formatArea, formatPrice, LISTING_TYPE_LABELS, locationLine } from '@/lib/format';
import { canEditPhotos, canEditPortfolio } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Portföy' };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZES = ['10', '25', '50', '100', '1000'];

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireWorkspace(slug);
  const q = one(sp['q'])?.slice(0, 100) ?? '';
  const listingType = one(sp['listingType']) ?? '';
  const sort = one(sp['sort']) ?? 'updated';
  const page = Math.max(1, Number(one(sp['page']) ?? 1) || 1);
  const pageSizeParam = one(sp['pageSize']) ?? '25';
  const pageSize = (PAGE_SIZES as readonly string[]).includes(pageSizeParam) ? pageSizeParam : '25';
  const manager = canEditPortfolio(tenant.role);

  const data = await getProperties(tenant.id, {
    q: q || undefined,
    listingType: listingType === 'SALE' || listingType === 'RENT' ? listingType : undefined,
    sort: ['updated', 'price_desc', 'price_asc', 'coverage_desc', 'coverage_asc'].includes(sort)
      ? sort
      : 'updated',
    page: String(page),
    pageSize,
  });
  const base = `/w/${tenant.slug}/properties`;
  const filtered = Boolean(q || listingType);
  const pageHref = (n: number, size: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (listingType) p.set('listingType', listingType);
    if (sort !== 'updated') p.set('sort', sort);
    if (size !== '25') p.set('pageSize', size);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Portföy</h1>
          <p className="text-sm text-muted-foreground">
            {data.total} mülk{filtered ? ' (filtrelenmiş)' : ''} · veri doluluğu ve fotoğraflar tek
            bakışta
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditPhotos(tenant.role) && <CsvExportButton tenantId={tenant.id} />}
          {manager && (
            <>
              <Link href={`${base}/imports`} className={buttonVariants({ variant: 'outline' })}>
                <HistoryIcon aria-hidden />
                İçe aktarma geçmişi
              </Link>
              <Link href={`${base}/import`} className={buttonVariants()}>
                <UploadIcon aria-hidden />
                İçe aktar
              </Link>
            </>
          )}
        </div>
      </section>

      <DataTable
        label="Portföy"
        rows={data.items}
        rowKey={(p) => p.id}
        toolbar={
          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <PropertyFilters q={q} listingType={listingType} sort={sort} />
          </div>
        }
        empty={
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/30 px-6 py-20 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
              <PlusIcon className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">
                {filtered ? 'Sonuç bulunamadı' : 'Henüz portföy yok'}
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {filtered
                  ? 'Aramanızı ya da filtreleri değiştirin.'
                  : manager
                    ? 'CRM’inizden ya da Excel’den aldığınız listeyi CSV veya XLSX olarak yükleyin.'
                    : 'Portföy, workspace yöneticileri tarafından içe aktarılır.'}
              </p>
            </div>
            {filtered ? (
              <Link href={base} className={buttonVariants({ variant: 'outline' })}>
                Filtreleri temizle
              </Link>
            ) : (
              manager && (
                <Link href={`${base}/import`} className={buttonVariants()}>
                  <UploadIcon aria-hidden />
                  Portföy içe aktar
                </Link>
              )
            )}
          </div>
        }
        pagination={{
          page,
          pageSize,
          total: data.total,
          pageSizes: PAGE_SIZES,
          defaultPageSize: '25',
          unit: 'mülk',
          pageHref: (n, size) => pageHref(n, size),
        }}
        columns={[
          {
            id: 'property',
            header: 'Mülk',
            width: 'minmax(0,2.4fr)',
            cell: (p) => (
              <div className="flex min-w-0 items-center gap-4">
                <PropertyThumb url={p.coverThumbnailUrl} alt="" className="h-16 w-24 rounded-lg" />
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`${base}/${p.id}`} className="truncate font-medium hover:underline">
                    {p.title}
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">
                    {LISTING_TYPE_LABELS[p.listingType]}
                    {p.externalId ? ` · ${p.externalId}` : ''}
                    {locationLine(p) ? ` · ${locationLine(p)}` : ''}
                  </span>
                  {p.photoCount === 0 ? (
                    <span className="w-fit rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      Fotoğraf yok
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{p.photoCount} fotoğraf</span>
                  )}
                </div>
              </div>
            ),
          },
          {
            id: 'price',
            header: 'Fiyat',
            width: '1fr',
            hideBelow: 'md',
            cell: (p) =>
              formatPrice(p.priceMinor, p.priceCurrency) ? (
                <span className="font-semibold tabular-nums">
                  {formatPrice(p.priceMinor, p.priceCurrency)}
                </span>
              ) : (
                <span className="text-muted-foreground">Fiyat yok</span>
              ),
          },
          {
            id: 'layout',
            header: 'Oda · Alan',
            width: '1fr',
            hideBelow: 'lg',
            cell: (p) => (
              <span className="text-sm text-muted-foreground tabular-nums">
                {[p.roomLayout, formatArea(p.grossAreaM2)].filter(Boolean).join(' · ') || '—'}
              </span>
            ),
          },
          {
            id: 'coverage',
            header: 'Veri doluluğu',
            width: 'minmax(0,1.2fr)',
            cell: (p) => (
              <div className="flex flex-col gap-1.5">
                <CoverageBadge score={p.coverageScore} />
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn(
                      'h-full rounded-full',
                      p.coverageScore >= 75
                        ? 'bg-emerald-500'
                        : p.coverageScore >= 45
                          ? 'bg-amber-500'
                          : 'bg-red-500',
                    )}
                    style={{ width: `${p.coverageScore}%` }}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
