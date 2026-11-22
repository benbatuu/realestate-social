import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPinIcon } from 'lucide-react';
import { CoverageCard } from '@/components/properties/coverage-card';
import { PhotoGallery } from '@/components/properties/photo-gallery';
import { PhotoViewer } from '@/components/properties/photo-viewer';
import { PropertyDescription } from '@/components/properties/property-description';
import { PropertyEditForm } from '@/components/properties/property-edit-form';
import { VideoPanel } from '@/components/properties/video-panel';
import { Badge } from '@/components/ui/badge';
import { getProperty } from '@/lib/api/server';
import {
  formatDateTime,
  formatPrice,
  LISTING_TYPE_LABELS,
  locationLine,
  PROPERTY_STATUS_LABELS,
} from '@/lib/format';
import { canEditPhotos, canEditPortfolio } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { requireWorkspace } from '../../workspace';

export const metadata: Metadata = { title: 'Mülk' };

const TABS = [
  { key: 'genel', label: 'Genel' },
  { key: 'bilgiler', label: 'Emlak bilgileri' },
  { key: 'fotograflar', label: 'Fotoğraflar' },
  { key: 'videolar', label: 'Videolar' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const requested = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: TabKey = TABS.some((t) => t.key === requested) ? (requested as TabKey) : 'genel';

  const { tenant } = await requireWorkspace(slug);
  const property = await getProperty(tenant.id, id);
  if (!property) notFound();
  const base = `/w/${tenant.slug}/properties`;
  const detail = `${base}/${property.id}`;
  const price = formatPrice(property.priceMinor, property.priceCurrency);
  const location = locationLine(property);
  const manager = canEditPortfolio(tenant.role);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Emlak sekmeleri" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => {
          const count = t.key === 'fotograflar' ? property.photoCount : null;
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === 'genel' ? detail : `${detail}?tab=${t.key}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-sm transition-colors',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {count !== null && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === 'genel' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="flex min-w-0 flex-col xl:col-span-2">
              <PhotoViewer assets={property.assets} title={property.title} />
            </div>
            <aside className="flex min-w-0 flex-col gap-6">
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{LISTING_TYPE_LABELS[property.listingType]}</Badge>
                  {property.status !== 'ACTIVE' && (
                    <Badge variant="outline">{PROPERTY_STATUS_LABELS[property.status]}</Badge>
                  )}
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-balance">
                  {property.title}
                </h1>
                {location && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPinIcon className="size-3.5" aria-hidden />
                    {location}
                  </p>
                )}
                <div className="flex items-end justify-between gap-3 border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {property.externalId ? `İlan no ${property.externalId}` : ''}
                  </span>
                  {price && <span className="text-xl font-semibold tabular-nums">{price}</span>}
                </div>
              </section>
              <CoverageCard coverage={property.coverage} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Kaynak: {property.source.name ?? 'Bilinmiyor'}
                {property.source.lastSyncedAt
                  ? ` · son güncelleme ${formatDateTime(property.source.lastSyncedAt)}`
                  : ''}
                . Bilgiler kaynaktan gelir; düzeltmek için kaynakta değiştirip yeniden içe aktarın.
              </p>
            </aside>
          </div>
          <PropertyDescription
            tenantId={tenant.id}
            propertyId={property.id}
            description={property.description}
            canEdit={manager}
          />
        </div>
      )}

      {tab === 'bilgiler' && (
        <PropertyEditForm tenantId={tenant.id} property={property} canEdit={manager} />
      )}

      {tab === 'fotograflar' && (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Fotoğraflar</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {property.photoCount} fotoğraf
            </span>
          </div>
          <PhotoGallery
            tenantId={tenant.id}
            propertyId={property.id}
            title={property.title}
            assets={property.assets}
            editable={canEditPhotos(tenant.role)}
          />
        </section>
      )}

      {tab === 'videolar' && (
        <VideoPanel
          tenantId={tenant.id}
          propertyId={property.id}
          photoCount={property.photoCount}
          slug={tenant.slug}
          photos={property.assets.map((a) => ({ id: a.id, url: a.thumbnailUrl }))}
          canCreate={canEditPhotos(tenant.role)}
        />
      )}
    </div>
  );
}
