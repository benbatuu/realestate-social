'use client';

import type { MembershipRole } from '@app/shared';
import { SearchIcon, XIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ROLE_LABELS } from '@/lib/roles';

const ROLES = Object.keys(ROLE_LABELS) as MembershipRole[];

/** Search and filters for the team table. The URL holds them, so links and reloads keep them. */
export function TeamFilters({ q, role, status }: { q: string; role: string; status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(q);
  const active = Boolean(q || role || status);

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

  useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => apply({ q: text.trim() }), 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="relative min-w-56 flex-1">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Ekipte ara"
          placeholder="Ad veya e-posta ara"
          className="pl-8"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <NativeSelect
        aria-label="Rol"
        className="w-44"
        value={role}
        onChange={(e) => apply({ role: e.target.value })}
      >
        <option value="">Tüm roller</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Durum"
        className="w-44"
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
      >
        <option value="">Tüm durumlar</option>
        <option value="active">Aktif</option>
        <option value="inactive">Pasif</option>
        <option value="pending">Bekliyor</option>
      </NativeSelect>
      {active && (
        <Button
          variant="ghost"
          onClick={() => {
            setText('');
            router.replace(pathname, { scroll: false });
          }}
        >
          <XIcon aria-hidden />
          Filtreleri temizle
        </Button>
      )}
    </div>
  );
}
