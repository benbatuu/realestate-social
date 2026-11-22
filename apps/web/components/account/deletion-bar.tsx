'use client';

import type { AccountDeletion } from '@app/shared';
import { AlertTriangleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';

const DAY = 24 * 3600 * 1000;

/** Always-visible notice while a deletion is scheduled. It cannot be dismissed, only cancelled. */
export function DeletionBar({ deletion }: { deletion: AccountDeletion }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const left = Math.max(
    0,
    Math.ceil((new Date(deletion.scheduledFor).getTime() - Date.now()) / DAY),
  );
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 md:px-8"
    >
      <p className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
        <span>
          Hesabınız <strong>{left} gün</strong> sonra silinecek. Bu süre içinde kredileriniz
          kullanılabilir.
        </span>
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await apiPost(`/auth/data-requests/${deletion.id}/cancel`);
          setBusy(false);
          if (!res.ok) return toast.error(errorMessage(res.error));
          toast.success('Silme talebi iptal edildi.');
          router.refresh();
        }}
      >
        Talebi iptal et
      </Button>
    </div>
  );
}
