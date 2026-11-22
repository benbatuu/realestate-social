'use client';

import type { AccountDeletion } from '@app/shared';
import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiDownload } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { DeletionWizard } from './deletion-wizard';

/** KVKK rights: a copy of your data, and a request to delete your account. */
export function DataActions({ openDeletion }: { openDeletion: AccountDeletion | null }) {
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(false);
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-0 md:divide-x">
      <div className="flex flex-col items-start gap-2 md:pr-6">
        <p className="text-sm font-medium">Verilerimin bir kopyası</p>
        <p className="text-sm text-muted-foreground">
          Hesabınızla ilgili tüm bilgileri JSON dosyası olarak indirin.
        </p>
        <Button
          variant="outline"
          className="w-fit"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await apiDownload('/auth/data-export', 'verilerim.json');
            setBusy(false);
            if (!ok) toast.error('Dosya indirilemedi.');
          }}
        >
          <DownloadIcon aria-hidden />
          Verilerimi indir
        </Button>
      </div>

      <div className="flex flex-col items-start gap-2 md:pl-6">
        <p className="text-sm font-medium">Hesabımı kapat</p>
        {openDeletion ? (
          <p className="text-sm text-muted-foreground">
            Silme talebiniz var. Hesabınız {formatDate(openDeletion.scheduledFor)} tarihinde
            silinecek. Üstteki bildirimden iptal edebilirsiniz.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Talep ettikten sonra hesabınız 14 gün içinde silinir. Bu süre içinde kredilerinizi
              kullanmaya devam edebilir ve talebi iptal edebilirsiniz.
            </p>
            <Button variant="destructive" className="w-fit" onClick={() => setWizard(true)}>
              Hesap silme talep et
            </Button>
          </>
        )}
      </div>

      <DeletionWizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}
