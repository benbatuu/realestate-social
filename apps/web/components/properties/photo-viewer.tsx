'use client';

import type { PropertyAsset } from '@app/shared';
import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Large photo with arrows, counter and a thumbnail strip. Read-only; editing lives below. */
export function PhotoViewer({ assets, title }: { assets: PropertyAsset[]; title: string }) {
  const [index, setIndex] = useState(0);
  const count = assets.length;
  const current = assets[index];

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  if (!current) {
    return (
      <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
        <ImageOffIcon className="size-6" aria-hidden />
        Henüz fotoğraf yok.
      </div>
    );
  }

  const go = (dir: -1 | 1) => setIndex((i) => (i + dir + count) % count);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="group relative min-h-80 flex-1 overflow-hidden rounded-xl bg-muted">
        <Image
          key={current.id}
          src={current.url}
          alt={`${title} — fotoğraf ${index + 1}`}
          fill
          unoptimized
          sizes="(min-width: 1280px) 60vw, 100vw"
          priority={index === 0}
          className="object-cover"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Önceki fotoğraf"
              className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-sm transition hover:bg-background"
            >
              <ChevronLeftIcon className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Sonraki fotoğraf"
              className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-sm transition hover:bg-background"
            >
              <ChevronRightIcon className="size-5" aria-hidden />
            </button>
          </>
        )}
        <span className="absolute right-3 bottom-3 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium tabular-nums">
          {index + 1} / {count}
        </span>
      </div>

      {count > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {assets.map((a, i) => (
            <li key={a.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Fotoğraf ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'relative block h-16 w-24 overflow-hidden rounded-md bg-muted ring-2 transition',
                  i === index ? 'ring-primary' : 'ring-transparent hover:ring-border',
                )}
              >
                <Image
                  src={a.thumbnailUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
