'use client';

import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiDownload } from '@/lib/api/client';

export function CsvExportButton({ tenantId }: { tenantId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const ok = await apiDownload('/properties/export.csv', 'portfoy.csv', { tenantId });
        setBusy(false);
        if (!ok) toast.error('Dosya indirilemedi.');
      }}
    >
      <DownloadIcon aria-hidden />
      CSV indir
    </Button>
  );
}
