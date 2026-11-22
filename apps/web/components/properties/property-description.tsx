'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { apiPatch } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

/** The listing description: its own card, read as text, edited in place. */
export function PropertyDescription({
  tenantId,
  propertyId,
  description,
  canEdit,
}: {
  tenantId: string;
  propertyId: string;
  description: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const isLong = (description?.length ?? 0) > 500;

  async function save() {
    setError(null);
    const next = draft.trim() === '' ? null : draft.trim();
    if (next === (description ?? null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await apiPatch(`/properties/${propertyId}`, { description: next }, { tenantId });
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    toast.success('Açıklama güncellendi.');
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Açıklama</h2>
        {canEdit &&
          (editing ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Vazgeç
              </Button>
              <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(description ?? '');
                setError(null);
                setEditing(true);
              }}
            >
              Düzenle
            </Button>
          ))}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <FormError message={error} />
          <textarea
            aria-label="Açıklama"
            rows={12}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Elle değiştirdiğiniz açıklama sonraki içe aktarmalarda ezilmez.
          </p>
        </div>
      ) : description ? (
        <div className="flex flex-col items-start gap-3">
          <p
            className={cn(
              'text-sm leading-relaxed whitespace-pre-line',
              !expanded && isLong && 'line-clamp-8',
            )}
          >
            {description}
          </p>
          {isLong && (
            <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Daralt' : 'Devamını oku'}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Açıklama yok.</p>
      )}
    </section>
  );
}
