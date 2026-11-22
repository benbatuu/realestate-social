'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

const SORTS = [
  ['updated', 'Son güncellenen'],
  ['price_desc', 'Fiyat (yüksek)'],
  ['price_asc', 'Fiyat (düşük)'],
  ['coverage_desc', 'Doluluk (yüksek)'],
  ['coverage_asc', 'Doluluk (düşük)'],
] as const;

const TYPES = [
  ['', 'Tümü'],
  ['SALE', 'Satılık'],
  ['RENT', 'Kiralık'],
] as const;

/** Filters apply as you change them. The URL holds the state, so links and reloads keep it. */
export function PropertyFilters({
  q,
  listingType,
  sort,
}: {
  q: string;
  listingType: string;
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(q);

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Search waits for a short pause in typing, then updates the list.
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => apply({ q: text.trim() }), 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Başlık, ilan no veya konum"
          aria-label="Portföyde ara"
          className="pr-8 pl-8"
        />
        {text && (
          <button
            type="button"
            aria-label="Aramayı temizle"
            onClick={() => {
              setText('');
              apply({ q: '' });
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex rounded-lg border p-0.5" role="group" aria-label="İlan türü">
        {TYPES.map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={listingType === value}
            onClick={() => apply({ listingType: value })}
            className={cn(
              'h-7 rounded-md px-3 text-sm transition-colors',
              listingType === value
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <NativeSelect
        aria-label="Sırala"
        value={sort}
        onChange={(e) => apply({ sort: e.target.value === 'updated' ? '' : e.target.value })}
      >
        {SORTS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
