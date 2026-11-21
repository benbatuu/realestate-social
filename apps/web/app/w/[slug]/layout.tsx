import { PRODUCT_DISPLAY_NAME } from '@app/shared';
import type { ReactNode } from 'react';
import { NavLinks } from '@/components/app/nav-links';
import { UserMenu } from '@/components/app/user-menu';
import { WorkspaceSwitcher } from '@/components/app/workspace-switcher';
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

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-muted/30 px-3 py-4 md:flex">
        <p className="px-2 text-xs font-medium text-muted-foreground">{PRODUCT_DISPLAY_NAME}</p>
        <WorkspaceSwitcher current={tenant} tenants={me.tenants} />
        <NavLinks slug={tenant.slug} orientation="vertical" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-4 md:justify-end md:px-8">
          <div className="min-w-0 flex-1 md:hidden">
            <WorkspaceSwitcher current={tenant} tenants={me.tenants} />
          </div>
          <UserMenu user={me.user} />
        </header>
        <div className="border-b px-2 py-2 md:hidden">
          <NavLinks slug={tenant.slug} orientation="horizontal" />
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
