'use client';

import { HouseIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Workspace navigation. Items are added as their milestones ship (portfolio, videos, credits);
 * the shell never links to screens that do not exist yet.
 */
const ITEMS = [
  { href: '', label: 'Genel bakış', icon: HouseIcon, exact: true },
  { href: '/team', label: 'Ekip', icon: UsersIcon, exact: false },
] as const;

export function NavLinks({
  slug,
  orientation,
}: {
  slug: string;
  orientation: 'vertical' | 'horizontal';
}) {
  const pathname = usePathname();
  const base = `/w/${slug}`;

  return (
    <nav
      aria-label="Workspace"
      className={cn(
        'flex gap-1',
        orientation === 'vertical' ? 'flex-col' : 'flex-row overflow-x-auto',
      )}
    >
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const target = `${base}${href}`;
        const active = exact ? pathname === target : pathname.startsWith(target);
        return (
          <Link
            key={label}
            href={target}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
              active
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
