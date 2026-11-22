'use client';

import type { Lead, LeadListResponse, LeadSource, LeadStatus } from '@app/shared';
import Link from 'next/link';
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon, UserSearchIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { apiDelete, apiGet, apiPatch } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LeadFormDialog } from './lead-form-dialog';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from './labels';

const PAGE_SIZES = ['10', '25', '50', '100', '1000'];

/** Leads: who asked about which property, and where they stand. */
export function LeadsView({
  tenantId,
  slug,
  canWrite,
  properties,
}: {
  tenantId: string;
  slug: string;
  canWrite: boolean;
  properties: { id: string; title: string }[];
}) {
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('25');
  const [data, setData] = useState<LeadListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ lead: Lead | null } | null>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (source) p.set('source', source);
    if (propertyId) p.set('propertyId', propertyId);
    if (q.trim()) p.set('q', q.trim());
    p.set('pageSize', pageSize);
    return p;
  }, [status, source, propertyId, q, pageSize]);

  useEffect(() => setPage(1), [query]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams(query);
    p.set('page', String(page));
    const res = await apiGet<LeadListResponse>(`/leads?${p.toString()}`, { tenantId });
    setLoading(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setError(null);
    setData(res.data);
  }, [query, page, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Status can change right in the row; the list refreshes after each change. */
  async function changeStatus(lead: Lead, next: LeadStatus) {
    const res = await apiPatch<Lead>(`/leads/${lead.id}`, { status: next }, { tenantId });
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    void load();
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const res = await apiDelete(`/leads/${deleting.id}`, { tenantId });
    setBusy(false);
    setDeleting(null);
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    toast.success('Lead silindi.');
    void load();
  }

  const total = data?.total ?? 0;
  const filtered = Boolean(status || source || propertyId || q.trim());
  const summary = data?.summary;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Leadler</h1>
          <p className="text-sm text-muted-foreground">
            Mülklerinizle ilgilenen kişiler ve bulundukları aşama.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setForm({ lead: null })}>
            <PlusIcon aria-hidden />
            Lead ekle
          </Button>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Toplam lead" value={summary?.total} />
        <Kpi label="Açık" value={summary?.open} hint="Yeni, ulaşıldı ya da uygun" />
        <Kpi label="Son 30 gün" value={summary?.last30Days} />
        <Kpi label="Kazanılan" value={summary?.won} />
      </div>

      <FormError message={error} />

      <DataTable
        label="Leadler"
        rows={data?.items ?? []}
        rowKey={(lead) => lead.id}
        toolbar={
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="relative min-w-56 flex-1">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ad, not ya da mülk ara"
                aria-label="Lead ara"
                className="pl-8"
              />
            </div>
            <NativeSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Durum"
            >
              <option value="">Tüm durumlar</option>
              {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label="Kaynak"
            >
              <option value="">Tüm kaynaklar</option>
              {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              aria-label="Mülk"
              className="w-56 max-w-full"
            >
              <option value="">Tüm mülkler</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
        empty={
          !data || loading ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Yükleniyor…
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-20 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
                <UserSearchIcon className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">
                  {filtered ? 'Sonuç bulunamadı' : 'Henüz lead yok'}
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  {filtered
                    ? 'Filtreleri değiştirin ya da temizleyin.'
                    : 'Mülklerinizle ilgilenen kişileri ekleyin. Her lead bir mülk ve bir aşamayla izlenir.'}
                </p>
              </div>
              {!filtered && canWrite && (
                <Button onClick={() => setForm({ lead: null })}>
                  <PlusIcon aria-hidden />
                  İlk leadi ekle
                </Button>
              )}
            </div>
          )
        }
        pagination={{
          page,
          pageSize,
          pageSizes: PAGE_SIZES,
          defaultPageSize: '25',
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          total,
          unit: 'lead',
          onPageChange: setPage,
        }}
        columns={[
          {
            id: 'lead',
            header: 'Lead',
            width: 'minmax(0,2.2fr)',
            cell: (lead) => (
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={`/w/${slug}/leads/${lead.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {lead.label ?? 'İsimsiz lead'}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  {formatDate(lead.createdAt)}
                </span>
              </div>
            ),
          },
          {
            id: 'property',
            header: 'Mülk',
            width: 'minmax(0,1.6fr)',
            cell: (lead) => (
              <span className="truncate text-sm">
                {lead.propertyTitle ?? <span className="text-muted-foreground">Belirtilmedi</span>}
              </span>
            ),
          },
          {
            id: 'source',
            header: 'Kaynak',
            width: 'minmax(0,1fr)',
            hideBelow: 'md',
            cell: (lead) => (
              <span className="text-sm text-muted-foreground">
                {LEAD_SOURCE_LABELS[lead.source]}
              </span>
            ),
          },
          {
            id: 'status',
            header: 'Durum',
            width: 'minmax(0,1.1fr)',
            cell: (lead) =>
              canWrite ? (
                <NativeSelect
                  aria-label={`${lead.label ?? 'Lead'} durumu`}
                  value={lead.status}
                  onChange={(e) => void changeStatus(lead, e.target.value as LeadStatus)}
                  className={cn('h-7 py-0 text-xs font-medium', LEAD_STATUS_TONE[lead.status])}
                >
                  {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <span
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium',
                    LEAD_STATUS_TONE[lead.status],
                  )}
                >
                  {LEAD_STATUS_LABELS[lead.status]}
                </span>
              ),
          },
          {
            id: 'actions',
            header: '',
            align: 'right',
            width: '1%',
            cell: (lead) =>
              canWrite ? (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Düzenle"
                    onClick={() => setForm({ lead })}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Sil"
                    onClick={() => setDeleting(lead)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />

      {form && (
        <LeadFormDialog
          tenantId={tenantId}
          slug={slug}
          lead={form.lead}
          properties={properties}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Lead silinsin mi?"
        description="Bu lead kalıcı olarak silinir. Bu işlem geri alınamaz."
        confirmLabel="Evet, sil"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value?: number | undefined;
  hint?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value ?? '—'}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
