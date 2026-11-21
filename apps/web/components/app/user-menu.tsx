'use client';

import type { User } from '@app/shared';
import { LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();

  async function logout() {
    const result = await apiPost<void>('/auth/logout');
    if (!result.ok && result.error.code !== 'UNAUTHENTICATED') {
      toast.error(errorMessage(result.error));
      return;
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Hesap menüsü"
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOutIcon className="size-4" aria-hidden />
          Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
