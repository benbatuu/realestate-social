import type { Metadata } from 'next';
import { AnalyticsView } from '@/components/analytics/analytics-view';
import { canEditPhotos } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Analiz' };

export default async function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  return (
    <AnalyticsView tenantId={tenant.id} slug={tenant.slug} canRun={canEditPhotos(tenant.role)} />
  );
}
