import type { Metadata } from 'next';
import { IntegrationsView } from '@/components/integrations/integrations-view';
import { canImport } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'CRM bağlantıları' };

export default async function IntegrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  return (
    <IntegrationsView tenantId={tenant.id} slug={tenant.slug} canManage={canImport(tenant.role)} />
  );
}
