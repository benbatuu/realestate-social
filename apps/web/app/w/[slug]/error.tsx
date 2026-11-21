'use client';

import { Button } from '@/components/ui/button';

export default function WorkspaceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">Sayfa yüklenemedi</h2>
        <p className="text-sm text-muted-foreground">
          Bir sorun oluştu. Tekrar deneyin; sorun sürerse daha sonra tekrar gelin.
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
