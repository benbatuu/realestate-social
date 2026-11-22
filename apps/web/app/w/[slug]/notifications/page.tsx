import type { Metadata } from 'next';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Bildirimler' };

export default async function NotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  return <NotificationsView tenantId={tenant.id} slug={tenant.slug} />;
}
