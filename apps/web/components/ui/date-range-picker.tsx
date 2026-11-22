'use client';

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface DateRange {
  /** YYYY-MM-DD, or '' when not set. */
  from: string;
  to: string;
}

export const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
};
const label = (s: string) => {
  const d = parse(s);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]?.slice(0, 3)} ${d.getUTCFullYear()}` : '';
};

/** Days of one month as a 6x7 grid (Monday first). Null cells are padding. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(iso(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * One calendar for a date range, like airline booking pickers: click a start day, then an end day.
 * Hovering after the first click previews the range. Shows two months on wide screens.
 */
export function DateRangePicker({
  value,
  onChange,
  label: ariaLabel = 'Tarih aralığı',
  align = 'left',
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  label?: string;
  /** Which edge of the field the calendar opens from; use `right` near the right edge of the screen. */
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(() => {
    const d = parse(value.from) ?? new Date();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });
  const root = useRef<HTMLDivElement>(null);

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

  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  function pick(day: string) {
    if (picking === 'start') {
      // A new start clears the old end: the range is rebuilt from the first click.
      onChange({ from: day, to: '' });
      setPicking('end');
      return;
    }
    // Picking a day before the start makes it the new start.
    if (day < value.from) {
      onChange({ from: day, to: '' });
      setPicking('end');
      return;
    }
    onChange({ from: value.from, to: day });
    setPicking('start');
    setHover(null);
    setOpen(false);
  }

  const shownEnd =
    picking === 'end' && hover && value.from && hover >= value.from ? hover : value.to;
  const inRange = (day: string) => !!value.from && !!shownEnd && day > value.from && day < shownEnd;

  // One month at a time. Arrows move through months, so the end date can be far from the start.
  const months = useMemo(() => [{ y: view.y, m: view.m }], [view]);

  const text = value.from
    ? value.to
      ? `${label(value.from)} – ${label(value.to)}`
      : `${label(value.from)} – …`
    : '';

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setPicking(value.from && !value.to ? 'end' : 'start');
        }}
        className="flex h-8 w-72 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn('flex-1 truncate', !text && 'text-muted-foreground')}>
          {text || 'Tarih aralığı seçin'}
        </span>
        {(value.from || value.to) && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Tarihi temizle"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ from: '', to: '' });
              setPicking('start');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onChange({ from: '', to: '' });
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
          aria-label="Tarih seçimi"
          className={cn(
            'absolute top-full z-40 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-4 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="Önceki ay"
              className="rounded p-1 hover:bg-accent"
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
            </button>
            <p className="text-xs text-muted-foreground">
              {picking === 'start' ? 'Başlangıç günü seçin' : 'Bitiş günü seçin'}
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

          <div className="flex flex-col gap-6 md:flex-row">
            {months.map((mo) => (
              <div key={`${mo.y}-${mo.m}`} className="w-72 shrink-0">
                <p className="mb-2 text-center text-sm font-medium">
                  {MONTHS[mo.m]} {mo.y}
                </p>
                <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-muted-foreground">
                  {WEEKDAYS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-sm">
                  {monthGrid(mo.y, mo.m).map((day, i) => {
                    if (!day) return <span key={i} />;
                    const isStart = day === value.from;
                    const isEnd = day === shownEnd && !!shownEnd;
                    const edge = isStart || isEnd;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => pick(day)}
                        onMouseEnter={() => setHover(day)}
                        aria-pressed={edge}
                        aria-label={label(day)}
                        className={cn(
                          'mx-auto flex size-8 items-center justify-center rounded-md',
                          edge && 'bg-primary text-primary-foreground',
                          !edge && inRange(day) && 'bg-accent text-accent-foreground',
                          !edge && !inRange(day) && 'hover:bg-accent',
                        )}
                      >
                        {Number(day.slice(8))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
