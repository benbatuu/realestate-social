'use client';

import type { TenantSummary } from '@app/shared';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function WorkspaceSwitcher({
  current,
  tenants,
}: {
  current: TenantSummary;
  tenants: TenantSummary[];
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Workspace değiştir"
      >
        <span className="truncate">{current.name}</span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspace&apos;ler</DropdownMenuLabel>
          {tenants.map((t) => (
            <DropdownMenuItem key={t.id} onClick={() => router.push(`/w/${t.slug}`)}>
              <span className="truncate">{t.name}</span>
              {t.id === current.id && <CheckIcon className="ml-auto size-4" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/onboarding')}>
          <PlusIcon className="size-4" aria-hidden />
          Yeni workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
