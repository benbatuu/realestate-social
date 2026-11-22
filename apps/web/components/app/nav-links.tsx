'use client';

import {
  BarChart3Icon,
  BellIcon,
  Building2Icon,
  CreditCardIcon,
  FilmIcon,
  HouseIcon,
  PlugIcon,
  ScrollTextIcon,
  SettingsIcon,
  UserSearchIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Only for owners and admins. */
  adminOnly?: boolean;
  /** Visible to managers and above only. */
  managerOnly?: boolean;
  /** Screen exists as a placeholder; the real content arrives with its milestone. */
  soon?: boolean;
}

const SECTIONS: { title: string | null; items: Item[] }[] = [
  {
    title: null,
    items: [
      { href: '', label: 'Genel bakış', icon: HouseIcon, exact: true },
      { href: '/properties', label: 'Portföy', icon: Building2Icon },
      { href: '/videos', label: 'Videolar', icon: FilmIcon },
    ],
  },
  {
    title: 'Büyüme',
    items: [
      { href: '/leads', label: 'Leadler', icon: UserSearchIcon },
      { href: '/analytics', label: 'Analiz', icon: BarChart3Icon },
      { href: '/integrations', label: 'CRM bağlantıları', icon: PlugIcon },
    ],
  },
  {
    title: 'Ekip ve hesap',
    items: [
      { href: '/team', label: 'Ekip', icon: UsersIcon },
      { href: '/billing', label: 'Faturalandırma', icon: CreditCardIcon, managerOnly: true },
      { href: '/notifications', label: 'Bildirimler', icon: BellIcon },
      { href: '/audit', label: 'Denetim kayıtları', icon: ScrollTextIcon, adminOnly: true },
      { href: '/settings', label: 'Ayarlar', icon: SettingsIcon },
    ],
  },
];

/** Workspace navigation. Placeholder screens are listed too, marked "Yakında". */
export function NavLinks({
  slug,
  orientation,
  isAdmin,
  isManager,
}: {
  slug: string;
  orientation: 'vertical' | 'horizontal';
  isAdmin: boolean;
  isManager: boolean;
}) {
  const pathname = usePathname();
  const base = `/w/${slug}`;
  const vertical = orientation === 'vertical';

  return (
    <nav
      aria-label="Workspace"
      className={cn('flex', vertical ? 'flex-col gap-5' : 'flex-row gap-1 overflow-x-auto')}
    >
      {SECTIONS.map((section) => {
        const items = section.items.filter(
          (i) => (!i.adminOnly || isAdmin) && (!i.managerOnly || isManager),
        );
        if (items.length === 0) return null;
        return (
          <div
            key={section.title ?? 'main'}
            className={cn('flex', vertical ? 'flex-col gap-1' : 'flex-row gap-1')}
          >
            {vertical && section.title && (
              <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {section.title}
              </p>
            )}
            {items.map(({ href, label, icon: Icon, exact, soon }) => {
              const target = `${base}${href}`;
              const active = exact ? pathname === target : pathname.startsWith(target);
              return (
                <Link
                  key={label}
                  href={target}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm whitespace-nowrap transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{label}</span>
                  {soon && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Yakında
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
