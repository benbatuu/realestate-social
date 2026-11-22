'use client';

import type { UserProfile } from '@app/shared';
import { CreditCardIcon, LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

/**
 * Top-bar account control: avatar and a menu with profile, settings, billing and sign-out.
 */
export function UserMenu({
  user,
  slug,
  isManager,
}: {
  user: UserProfile;
  slug: string;
  /** Billing is for managers and above. */
  isManager: boolean;
}) {
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
        className="flex items-center gap-3 rounded-md px-1.5 py-1 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Hesap menüsü"
      >
        <Avatar className="size-8">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
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
        <DropdownMenuItem onClick={() => router.push(`/w/${slug}/profile`)}>
          <UserIcon className="size-4" aria-hidden />
          Profil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/w/${slug}/settings`)}>
          <SettingsIcon className="size-4" aria-hidden />
          Ayarlar
        </DropdownMenuItem>
        {isManager && (
          <DropdownMenuItem onClick={() => router.push(`/w/${slug}/billing`)}>
            <CreditCardIcon className="size-4" aria-hidden />
            Faturalandırma
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOutIcon className="size-4" aria-hidden />
          Çıkış Yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
