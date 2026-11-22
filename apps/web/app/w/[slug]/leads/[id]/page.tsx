import type { Metadata } from 'next';
import { LeadDetailView } from '@/components/leads/lead-detail-view';
import { getProperties } from '@/lib/api/server';
import { canEditPhotos } from '@/lib/roles';
import { requireWorkspace } from '../../workspace';

export const metadata: Metadata = { title: 'Lead' };

export default async function LeadPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { tenant } = await requireWorkspace(slug);
  const props = await getProperties(tenant.id, { pageSize: '100' });
  return (
    <LeadDetailView
      tenantId={tenant.id}
      slug={tenant.slug}
      leadId={id}
      canWrite={canEditPhotos(tenant.role)}
      properties={props.items.map((p) => ({ id: p.id, title: p.title }))}
    />
  );
}
