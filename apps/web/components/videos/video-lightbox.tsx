'use client';

import type { VideoLibraryItem } from '@app/shared';
import { DownloadIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';

const FORMAT_LABEL = { PORTRAIT_9_16: 'Dikey (9:16)', LANDSCAPE_16_9: 'Yatay (16:9)' } as const;

/** Enlarged preview. Plays inline, switches format, and downloads the chosen file. */
export function VideoLightbox({ item, onClose }: { item: VideoLibraryItem; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const current = item.formats[index] ?? item.formats[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.propertyTitle} videosu`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col gap-4 rounded-xl bg-background p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{item.propertyTitle}</p>
            <p className="text-xs text-muted-foreground">
              {item.completedAt ? formatDateTime(item.completedAt) : ''} · {current.durationSeconds}{' '}
              sn
              {item.isMock ? ' · taslak' : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Kapat">
            <XIcon aria-hidden />
          </Button>
        </div>

        <div className="flex min-h-0 justify-center bg-black">
          {/* Plays through the signed URL; the browser streams it. */}
          <video
            key={current.playUrl}
            src={current.playUrl}
            controls
            playsInline
            className="max-h-[70vh] max-w-full"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="tablist" aria-label="Format">
            {item.formats.map((f, i) => (
              <Button
                key={f.format}
                variant={i === index ? 'default' : 'outline'}
                size="sm"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
              >
                {FORMAT_LABEL[f.format]}
              </Button>
            ))}
          </div>
          <a
            href={current.downloadUrl}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-accent"
          >
            <DownloadIcon className="size-4" aria-hidden />
            İndir
          </a>
        </div>
      </div>
    </div>
  );
}
