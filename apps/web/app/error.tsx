'use client';

import { Button } from '@/components/ui/button';

/** Fallback for pages outside a workspace (login, onboarding, invite) when the API fails. */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Şu an hizmet veremiyoruz</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Sunucuya ulaşılamadı. Birkaç dakika sonra tekrar deneyin.
      </p>
      <Button variant="outline" onClick={reset}>
        Tekrar dene
      </Button>
    </main>
  );
}
