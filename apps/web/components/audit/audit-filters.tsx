'use client';

import type { AuditCategory, Member } from '@app/shared';
import { SearchIcon, XIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { AUDIT_CATEGORY_LABELS } from '@/lib/audit-labels';

/** Audit search and filters. They live in the URL, so links and reloads keep them. */
export function AuditFilters({
  q,
  category,
  actorUserId,
  from,
  to,
  members,
}: {
  q: string;
  category: AuditCategory;
  actorUserId: string;
  from: string;
  to: string;
  members: Member[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(q);
  const active = Boolean(q || category !== 'all' || actorUserId || from || to);

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
    if (text.trim() === q) return;
    const t = setTimeout(() => apply({ q: text.trim() }), 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="relative min-w-56 flex-1">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Ara"
          placeholder="Kişi, lead veya mülk adı"
          className="pl-8"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <NativeSelect
        aria-label="Kategori"
        className="w-48"
        value={category}
        onChange={(e) => apply({ category: e.target.value === 'all' ? '' : e.target.value })}
      >
        {Object.entries(AUDIT_CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Kişi"
        className="w-44"
        value={actorUserId}
        onChange={(e) => apply({ actorUserId: e.target.value })}
      >
        <option value="">Herkes</option>
        {members.map((m) => (
          <option key={m.user.id} value={m.user.id}>
            {m.user.name}
          </option>
        ))}
      </NativeSelect>
      <Input
        type="date"
        aria-label="Başlangıç tarihi"
        className="w-40"
        value={from}
        max={to || undefined}
        onChange={(e) => apply({ from: e.target.value })}
      />
      <Input
        type="date"
        aria-label="Bitiş tarihi"
        className="w-40"
        value={to}
        min={from || undefined}
        onChange={(e) => apply({ to: e.target.value })}
      />
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
