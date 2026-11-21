import { PRODUCT_DISPLAY_NAME } from '@app/shared';
import type { Metadata } from 'next';
import { InviteAccept } from '@/components/auth/invite-accept';
import { getMe } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Davet' };

export default async function InvitePage() {
  const me = await getMe();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <p className="text-sm font-medium tracking-tight text-muted-foreground">
        {PRODUCT_DISPLAY_NAME}
      </p>
      <div className="w-full max-w-md">
        <InviteAccept user={me?.user ?? null} />
      </div>
    </main>
  );
}
