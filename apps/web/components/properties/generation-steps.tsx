'use client';

import { CheckIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Pipeline stages in order: short name for the track, wording while running. */
const STEPS: { stage: string; short: string; active: string }[] = [
  { stage: 'VALIDATING', short: 'Kontrol', active: 'Mülk bilgileri kontrol ediliyor' },
  { stage: 'ANALYZING_PHOTOS', short: 'Analiz', active: 'Fotoğraflar analiz ediliyor' },
  { stage: 'PLANNING_SCENES', short: 'Sahneler', active: 'Sahneler ayarlanıyor' },
  { stage: 'GENERATING_SCRIPT', short: 'Senaryo', active: 'Senaryo yazılıyor' },
  { stage: 'GENERATING_AI_SCENES', short: 'Hareket', active: 'Hareketli sahneler üretiliyor' },
  { stage: 'GENERATING_VOICE', short: 'Ses', active: 'Seslendirme yapılıyor' },
  { stage: 'SELECTING_MUSIC', short: 'Müzik', active: 'Müzik seçiliyor' },
  { stage: 'COMPOSING_VIDEO', short: 'Birleştir', active: 'Video birleştiriliyor' },
  { stage: 'RENDERING', short: 'Render', active: 'Dosyalar oluşturuluyor' },
  { stage: 'QUALITY_CHECK', short: 'Kalite', active: 'Kalite kontrolü yapılıyor' },
];

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Centered generation view. The stage and percent are real (from the server); the
 * photo cycling in the frame is only a visual, not a sign of what is being processed.
 */
export function GenerationSteps({
  stage,
  progress,
  photos,
}: {
  stage: string;
  progress: number;
  photos: { id: string; url: string }[];
}) {
  const current = STEPS.findIndex((s) => s.stage === stage);
  const queued = current === -1;
  const label = queued ? 'Sırada' : STEPS[current]?.active;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % photos.length), 2800);
    return () => clearInterval(t);
  }, [photos.length]);

  const shown = photos.length > 0 ? photos[frame % photos.length] : null;

  return (
    <div className="flex flex-col items-center gap-7 py-4 text-center" role="status" aria-live="polite">
      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl bg-neutral-900 shadow-lg">
        {shown ? (
          <Image
            key={shown.id}
            src={shown.url}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 768px) 28rem, 100vw"
            className="animate-in fade-in zoom-in-105 object-cover duration-1000"
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-700 to-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 text-sm font-medium text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
          {label}
        </div>
      </div>

      <div className="relative flex size-32 items-center justify-center">
        <svg viewBox="0 0 110 110" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="55" cy="55" r={RING_R} className="fill-none stroke-muted" strokeWidth="7" />
          <circle
            cx="55"
            cy="55"
            r={RING_R}
            className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - Math.min(100, Math.max(0, progress)) / 100)}
          />
        </svg>
        <span className="text-2xl font-semibold tabular-nums">%{progress}</span>
      </div>

      <ol className="flex w-full max-w-3xl items-start justify-between">
        {STEPS.map((step, i) => {
          const finished = !queued && i < current;
          const running = !queued && i === current;
          return (
            <li key={step.stage} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full items-center">
                {i > 0 && (
                  <span
                    className={cn(
                      'absolute right-1/2 left-[-50%] top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-colors duration-700',
                      finished || running ? 'bg-emerald-500' : 'bg-border',
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 mx-auto flex size-7 items-center justify-center rounded-full border-2 transition-all duration-500',
                    finished && 'border-emerald-500 bg-emerald-500 text-white',
                    running && 'scale-110 border-primary bg-primary/10',
                    !finished && !running && 'border-border bg-background',
                  )}
                >
                  {finished ? (
                    <CheckIcon className="size-3.5" aria-hidden />
                  ) : running ? (
                    <span className="size-2.5 animate-ping rounded-full bg-primary" aria-hidden />
                  ) : null}
                </span>
              </div>
              <span
                className={cn(
                  'max-w-full truncate text-[11px] transition-colors duration-500',
                  finished && 'text-muted-foreground',
                  running && 'font-semibold text-foreground',
                  !finished && !running && 'text-muted-foreground/60',
                )}
              >
                {step.short}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
