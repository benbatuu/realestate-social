'use client';

import type { Lead, LeadListResponse, LeadSource, LeadStatus } from '@app/shared';
import { XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { NativeSelect } from '@/components/ui/native-select';
import { apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from './labels';

interface Draft {
  label: string;
  email: string;
  phone: string;
  propertyId: string;
  assignedToId: string;
  source: LeadSource;
  status: LeadStatus;
  note: string;
  nextAction: string;
}

function toLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Custom popup for adding or editing a lead. Contact details stay out of the form. */
export function LeadFormDialog({
  tenantId,
  lead,
  properties,
  onClose,
  onSaved,
  slug,
}: {
  tenantId: string;
  slug: string;
  /** null: a new lead. */
  lead: Lead | null;
  properties: { id: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    label: lead?.label ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    propertyId: lead?.propertyId ?? '',
    assignedToId: lead?.assignedToId ?? '',
    source: lead?.source ?? 'MANUAL',
    status: lead?.status ?? 'NEW',
    note: '',
    nextAction: toLocal(lead?.nextActionAt ?? null),
  }));
  const [members, setMembers] = useState<{ id: string; label: string }[]>([]);
  const [dupes, setDupes] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Team members the lead can be handed to.
  useEffect(() => {
    void apiGet<{ user: { id: string; name?: string | null; email: string } }[]>(
      `/tenants/${tenantId}/members`,
      { tenantId },
    ).then((res) => {
      if (!res.ok) return;
      setMembers(res.data.map((m) => ({ id: m.user.id, label: m.user.name || m.user.email })));
    });
  }, [tenantId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  // Warns when another lead already carries the same short name; the same person is
  // usually one lead, not two.
  useEffect(() => {
    const name = draft.label.trim();
    if (name.length < 2) {
      setDupes([]);
      return;
    }
    const t = setTimeout(() => {
      void apiGet<LeadListResponse>(`/leads?q=${encodeURIComponent(name)}&pageSize=5`, {
        tenantId,
      }).then((res) => {
        if (!res.ok) return;
        setDupes(
          res.data.items
            .filter((i) => i.id !== lead?.id && i.label?.toLowerCase() === name.toLowerCase())
            .map((i) => ({ id: i.id, label: i.label ?? '' })),
        );
      });
    }, 400);
    return () => clearTimeout(t);
  }, [draft.label, lead?.id, tenantId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setError(null);
    const body = {
      label: draft.label.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      propertyId: draft.propertyId || null,
      assignedToId: draft.assignedToId || null,
      source: draft.source,
      status: draft.status,
      nextActionAt: draft.nextAction ? new Date(draft.nextAction).toISOString() : null,
      // A first note only on create; later notes are added on the lead page.
      ...(lead ? {} : { note: draft.note.trim() || null }),
    };
    setSaving(true);
    const res = lead
      ? await apiPatch<Lead>(`/leads/${lead.id}`, body, { tenantId })
      : await apiPost<Lead>('/leads', body, { tenantId });
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    toast.success(lead ? 'Lead güncellendi.' : 'Lead eklendi.');
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-form-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="lead-form-title" className="text-base font-semibold">
            {lead ? 'Leadi düzenle' : 'Yeni lead'}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Kapat"
            disabled={saving}
          >
            <XIcon aria-hidden />
          </Button>
        </div>

        <form
          className="flex flex-col gap-4 overflow-y-auto p-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <FormError message={error} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-label" className="text-sm font-medium">
                Ad soyad
              </label>
              <Input
                id="lead-label"
                value={draft.label}
                maxLength={80}
                placeholder="Örn: Ahmet Yılmaz"
                onChange={(e) => set('label', e.target.value)}
              />
              {dupes.length > 0 && (
                <p className="text-xs text-amber-800">
                  Aynı adda {dupes.length} lead var:{' '}
                  {dupes.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ', '}
                      <Link
                        href={`/w/${slug}/leads/${d.id}`}
                        className="underline underline-offset-2"
                      >
                        açın
                      </Link>
                    </span>
                  ))}
                  . Aynı kişiyse mevcut kaydı güncelleyin.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-email" className="text-sm font-medium">
                E-posta
              </label>
              <Input
                id="lead-email"
                type="email"
                value={draft.email}
                maxLength={120}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-phone" className="text-sm font-medium">
                Telefon
              </label>
              <Input
                id="lead-phone"
                inputMode="tel"
                value={draft.phone}
                maxLength={30}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-property" className="text-sm font-medium">
                İlgilendiği mülk
              </label>
              <NativeSelect
                id="lead-property"
                className="w-full"
                value={draft.propertyId}
                onChange={(e) => set('propertyId', e.target.value)}
              >
                <option value="">Belirtilmedi</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-assignee" className="text-sm font-medium">
                Sorumlu
              </label>
              <NativeSelect
                id="lead-assignee"
                className="w-full"
                value={draft.assignedToId}
                onChange={(e) => set('assignedToId', e.target.value)}
              >
                <option value="">Atanmadı</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-source" className="text-sm font-medium">
                Kaynak
              </label>
              <NativeSelect
                id="lead-source"
                className="w-full"
                value={draft.source}
                onChange={(e) => set('source', e.target.value as LeadSource)}
              >
                {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-status" className="text-sm font-medium">
                Durum
              </label>
              <NativeSelect
                id="lead-status"
                className="w-full"
                value={draft.status}
                onChange={(e) => set('status', e.target.value as LeadStatus)}
              >
                {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-next" className="text-sm font-medium">
              Sonraki adım (isteğe bağlı)
            </label>
            <DateTimePicker
              label="Sonraki adım"
              value={draft.nextAction}
              fullWidth
              onChange={(v) => set('nextAction', v)}
            />
          </div>

          {!lead && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lead-note" className="text-sm font-medium">
                Not
              </label>
              <textarea
                id="lead-note"
                rows={4}
                maxLength={2000}
                value={draft.note}
                onChange={(e) => set('note', e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
