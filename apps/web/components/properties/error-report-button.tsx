'use client';

import { DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiDownload } from '@/lib/api/client';

export function ErrorReportButton({ tenantId, importId }: { tenantId: string; importId: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        const ok = await apiDownload(
          `/imports/${importId}/errors.csv`,
          `ice-aktarma-hatalari-${importId.slice(0, 8)}.csv`,
          {
            tenantId,
          },
        );
        if (!ok) toast.error('Rapor indirilemedi.');
      }}
    >
      <DownloadIcon aria-hidden />
      Hata raporu
    </Button>
  );
}
