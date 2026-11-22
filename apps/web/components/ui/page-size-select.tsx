'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NativeSelect } from '@/components/ui/native-select';

/** Rows per page, kept in the URL. Changing it goes back to page 1. */
export function PageSizeSelect({
  value,
  options,
  defaultValue,
  onChange,
}: {
  value: string;
  options: readonly string[];
  defaultValue: string;
  /** State mode: called instead of changing the URL. */
  onChange?: ((size: string) => void) | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Sayfa başına
      <NativeSelect
        value={value}
        onChange={(e) => {
          if (onChange) {
            onChange(e.target.value);
            return;
          }
          const next = new URLSearchParams(params.toString());
          if (e.target.value === defaultValue) next.delete('pageSize');
          else next.set('pageSize', e.target.value);
          next.delete('page');
          const qs = next.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }}
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {s === '1000' ? 'Tümü' : s}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
