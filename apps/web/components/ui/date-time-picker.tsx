'use client';

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { monthGrid, MONTHS, WEEKDAYS } from './date-range-picker';

/** Same calendar as the date range picker, with a time of day. Value: YYYY-MM-DDTHH:mm, or ''. */
export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  label = 'Tarih ve saat',
  fullWidth = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  label?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [date, time = '09:00'] = value ? value.split('T') : ['', ''];
  const parsed = date ? date.split('-').map(Number) : null;
  const [view, setView] = useState(() => {
    const now = new Date();
    return { y: parsed?.[0] ?? now.getFullYear(), m: (parsed?.[1] ?? now.getMonth() + 1) - 1 };
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const [hh, mm] = time.split(':');
  const shownLabel = parsed
    ? `${parsed[2]} ${MONTHS[parsed[1]! - 1]?.slice(0, 3)} ${parsed[0]} · ${time}`
    : '';

  function setDay(day: string) {
    onChange(`${day}T${time}`);
  }
  function setTime(nextHh: string, nextMm: string) {
    if (date) onChange(`${date}T${nextHh}:${nextMm}`);
  }

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const cells = monthGrid(view.y, view.m);
  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  return (
    <div ref={root} className={cn('relative', fullWidth && 'w-full')}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60',
          fullWidth ? 'w-full' : 'w-72 max-w-full',
        )}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn('flex-1 truncate', !shownLabel && 'text-muted-foreground')}>
          {shownLabel || 'Tarih ve saat seçin'}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Tarihi temizle"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onChange('');
              }
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" aria-hidden />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Tarih ve saat seçimi"
          className="absolute top-full left-0 z-40 mt-2 w-72 rounded-xl border bg-popover p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="Önceki ay"
              className="rounded p-1 hover:bg-accent"
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-medium">
              {MONTHS[view.m]} {view.y}
            </p>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="Sonraki ay"
              className="rounded p-1 hover:bg-accent"
            >
              <ChevronRightIcon className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
            {cells.map((day, i) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDay(day)}
                  aria-pressed={day === date}
                  className={cn(
                    'mx-auto flex size-8 items-center justify-center rounded-full tabular-nums transition-colors hover:bg-accent',
                    day === date && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    day === today && day !== date && 'ring-1 ring-primary',
                  )}
                >
                  {Number(day.slice(8))}
                </button>
              ) : (
                <span key={`pad-${i}`} />
              ),
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Saat"
                value={hh ?? '09'}
                disabled={!date}
                onChange={(e) => setTime(e.target.value, mm ?? '00')}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">:</span>
              <select
                aria-label="Dakika"
                value={mm ?? '00'}
                disabled={!date}
                onChange={(e) => setTime(hh ?? '09', e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {['00', '15', '30', '45'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
