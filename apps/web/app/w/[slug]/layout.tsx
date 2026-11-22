import { PRODUCT_DISPLAY_NAME } from '@app/shared';
import type { ReactNode } from 'react';
import { Breadcrumb } from '@/components/app/breadcrumb';
import { CreditsSummary } from '@/components/app/credits-summary';
import { InactiveMembership } from '@/components/app/inactive-membership';
import { NavLinks } from '@/components/app/nav-links';
import { UserMenu } from '@/components/app/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { WorkspaceSwitcher } from '@/components/app/workspace-switcher';
import { getCredits, getOpenDeletion } from '@/lib/api/server';
import { DeletionBar } from '@/components/account/deletion-bar';
import { canImport, canManageMembers } from '@/lib/roles';
import { requireWorkspace } from './workspace';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { me, tenant } = await requireWorkspace(slug);
  // Paused member: checked before any workspace data call, which would be refused.
  if (tenant.membershipActive === false) {
    return <InactiveMembership workspaceName={tenant.name} />;
  }

  const credits = await getCredits(tenant.id);
  const deletion = await getOpenDeletion();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-background px-3 py-4 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span
            className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
            aria-hidden
          >
            {PRODUCT_DISPLAY_NAME.charAt(0)}
          </span>
          <span className="text-sm font-semibold tracking-tight">{PRODUCT_DISPLAY_NAME}</span>
        </div>
        <WorkspaceSwitcher current={tenant} tenants={me.tenants} />
        <NavLinks
          slug={tenant.slug}
          orientation="vertical"
          isAdmin={canManageMembers(tenant.role)}
          isManager={canImport(tenant.role)}
        />
        <div className="mt-auto pt-2">
          <CreditsSummary credits={credits} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur">
          <header className="flex h-14 items-center gap-3 border-b px-4 md:justify-between">
            <div className="min-w-0 flex-1 md:hidden">
              <WorkspaceSwitcher current={tenant} tenants={me.tenants} />
            </div>
            <div className="hidden min-w-0 flex-1 md:block">
              <Breadcrumb workspaceName={tenant.name} slug={tenant.slug} />
            </div>
            <span className="text-xs text-muted-foreground md:hidden" aria-label="Kalan kredi">
              {credits.credits.available} kr
            </span>
            <NotificationBell tenantId={tenant.id} slug={tenant.slug} />
            <UserMenu user={me.user} slug={tenant.slug} isManager={canImport(tenant.role)} />
          </header>
          {deletion && <DeletionBar deletion={deletion} />}
        </div>
        <div className="border-b px-2 py-2 md:hidden">
          <NavLinks
            slug={tenant.slug}
            orientation="horizontal"
            isAdmin={canManageMembers(tenant.role)}
            isManager={canImport(tenant.role)}
          />
        </div>
        <main className="w-full flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
