'use client';

import { PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InviteForm } from '@/components/team/invite-form';

/** "Davet et" button and its popup. The form inside is the same as before. */
export function InviteDialog({ tenantId, seatsFull }: { tenantId: string; seatsFull: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden />
        Davet et
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <h2 id="invite-title" className="text-base font-semibold">
                  Kişi davet et
                </h2>
                <p className="text-sm text-muted-foreground">
                  Davet edilen kişi bu e-posta adresiyle hesap açıp katılır.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
              >
                <XIcon aria-hidden />
              </Button>
            </div>
            <div className="overflow-y-auto p-5">
              <InviteForm tenantId={tenantId} seatsFull={seatsFull} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
