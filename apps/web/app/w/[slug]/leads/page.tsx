import type { Metadata } from 'next';
import { LeadsView } from '@/components/leads/leads-view';
import { getProperties } from '@/lib/api/server';
import { canEditPhotos } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Leadler' };

export default async function LeadsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  // Properties for the filter and the form (first 100 by recent update).
  const props = await getProperties(tenant.id, { pageSize: '100' });
  return (
    <LeadsView
      tenantId={tenant.id}
      slug={tenant.slug}
      canWrite={canEditPhotos(tenant.role)}
      properties={props.items.map((p) => ({ id: p.id, title: p.title }))}
    />
  );
}
