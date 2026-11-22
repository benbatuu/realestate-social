import type { Metadata } from 'next';
import { VideoLibrary } from '@/components/videos/video-library';
import { getProperties } from '@/lib/api/server';
import { canEditPhotos } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Videolar' };

export default async function VideosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  // Portfolio list for the filter (first 100 properties by recent update).
  const props = await getProperties(tenant.id, { pageSize: '100' });
  return (
    <VideoLibrary
      tenantId={tenant.id}
      properties={props.items.map((p) => ({ id: p.id, title: p.title }))}
      canEdit={canEditPhotos(tenant.role)}
    />
  );
}
