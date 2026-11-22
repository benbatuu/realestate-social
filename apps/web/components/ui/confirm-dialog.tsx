'use client';

import { TriangleAlertIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';

/** In-app confirmation. Replaces window.confirm so the look and wording stay ours. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Vazgeç',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the safe choice first, so Enter does not confirm by accident.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCancel}
            disabled={busy}
            aria-label="Kapat"
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        <div className="flex gap-3 px-5 py-5">
          {destructive && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              <TriangleAlertIcon className="size-4" aria-hidden />
            </span>
          )}
          <p id={descId} className="pt-1.5 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
          <Button ref={cancelRef} variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'İşleniyor…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
