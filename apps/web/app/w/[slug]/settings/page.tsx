import type { Metadata } from 'next';
import { WorkspaceProfileForm } from '@/components/account/workspace-profile-form';
import { SectionCard } from '@/components/app/section-card';
import { NotificationPreferences } from '@/components/notifications/notification-preferences';
import { getTenantDetail } from '@/lib/api/server';
import { canImport, canManageMembers } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Ayarlar' };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  const isAdmin = canManageMembers(tenant.role);
  const detail = isAdmin ? await getTenantDetail(tenant.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">Şirket bilgileri ve bildirim tercihleri.</p>
      </header>

      {detail && (
        <SectionCard
          title="Şirket bilgileri"
          description="Fatura ve resmi belgelerde kullanılır. Yalnızca yöneticiler değiştirebilir."
        >
          <WorkspaceProfileForm tenant={detail} />
        </SectionCard>
      )}

      <SectionCard
        title="Bildirim tercihleri"
        description="Hangi bildirimleri almak istediğinizi seçin. Bu tercih yalnızca size aittir."
      >
        <NotificationPreferences tenantId={tenant.id} showTeam={canImport(tenant.role)} />
      </SectionCard>
    </div>
  );
}
