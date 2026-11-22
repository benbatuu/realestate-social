'use client';

import type { LeadDetail, LeadStatus, PropertyDetail, VideoLibraryResponse } from '@app/shared';
import {
  ArrowLeftIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarXIcon,
  CircleDotIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PencilLineIcon,
  PlusIcon,
  HistoryIcon,
  PlayIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { LeadFormDialog } from './lead-form-dialog';
import { NoteHistoryDialog } from './note-history-dialog';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from './labels';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];

const EVENT_LABEL: Record<string, string> = {
  'lead.created': 'Lead eklendi',
  'lead.updated': 'Bilgiler güncellendi',
  'lead.deleted': 'Lead silindi',
  'lead.note_added': 'Not eklendi',
  'lead.note_deleted': 'Not silindi',
};

const FIELD_LABEL: Record<string, string> = {
  propertyId: 'mülk',
  source: 'kaynak',
  status: 'durum',
  label: 'kısa ad',
  note: 'not',
  nextActionAt: 'sonraki adım',
};

function eventText(action: string, metadata: LeadDetail['events'][number]['metadata']): string {
  if (action === 'lead.updated' && metadata) {
    const fields = String(metadata['fields'] ?? '')
      .split(',')
      .filter(Boolean);
    const parts: string[] = [];
    const status = metadata['status'];
    if (fields.includes('status') && typeof status === 'string' && status in LEAD_STATUS_LABELS) {
      parts.push(`durum ${LEAD_STATUS_LABELS[status as LeadStatus]} oldu`);
    }
    if (fields.includes('nextActionAt')) {
      const next = metadata['nextActionAt'];
      if (typeof next === 'string')
        parts.push(`sonraki adım ${formatDateTime(next)} olarak ayarlandı`);
      else if (next === null) parts.push('sonraki adım kaldırıldı');
      else parts.push('sonraki adım güncellendi');
    }
    const rest = fields
      .filter((f) => f !== 'status' && f !== 'nextActionAt')
      .map((f) => FIELD_LABEL[f] ?? f);
    if (rest.length > 0) parts.push(`${rest.join(', ')} güncellendi`);
    if (parts.length > 0) return parts.join(' · ');
  }
  return EVENT_LABEL[action] ?? action;
}

/** Icon and soft color of one timeline step, so the kind of step reads at a glance. */
function nodeStyle(item: {
  kind: 'note' | 'event';
  action?: string;
  metadata?: LeadDetail['events'][number]['metadata'];
}): { Icon: LucideIcon; tone: string } {
  if (item.kind === 'note') return { Icon: MessageSquareTextIcon, tone: 'bg-sky-100 text-sky-800' };
  const action = item.action ?? '';
  const meta = item.metadata ?? null;
  if (action === 'lead.created') return { Icon: PlusIcon, tone: 'bg-emerald-100 text-emerald-800' };
  if (action === 'lead.updated' && meta) {
    const fields = String(meta['fields'] ?? '').split(',');
    if (fields.includes('status') && typeof meta['status'] === 'string') {
      const status = meta['status'] as LeadStatus;
      return { Icon: CircleDotIcon, tone: LEAD_STATUS_TONE[status] ?? 'bg-muted text-foreground' };
    }
    if (fields.includes('nextActionAt')) {
      return meta['nextActionAt'] === null
        ? { Icon: CalendarXIcon, tone: 'bg-slate-100 text-slate-600' }
        : { Icon: CalendarClockIcon, tone: 'bg-amber-100 text-amber-800' };
    }
    return { Icon: PencilLineIcon, tone: 'bg-slate-100 text-slate-600' };
  }
  return { Icon: PencilLineIcon, tone: 'bg-slate-100 text-slate-600' };
}

/** ISO → value for a datetime-local input, in the user's local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

/** "bugün 15:14", "dün 09:30", or the full date for anything older. */
function whenText(iso: string, now: number): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const days = daysAgo(iso, now);
  if (days === 0 && new Date(now).getDate() === d.getDate()) return `bugün ${time}`;
  if (days <= 1 && new Date(now).getDate() - d.getDate() === 1) return `dün ${time}`;
  return formatDateTime(iso);
}

/** One lead: details, status, notes, next step, property and its videos, history. */
export function LeadDetailView({
  tenantId,
  slug,
  leadId,
  canWrite,
  properties,
}: {
  tenantId: string;
  slug: string;
  leadId: string;
  canWrite: boolean;
  properties: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [nextDraft, setNextDraft] = useState('');
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [videos, setVideos] = useState<VideoLibraryResponse['items']>([]);
  const [now, setNow] = useState(0);

  useEffect(() => setNow(Date.now()), []);

  const load = useCallback(async () => {
    const res = await apiGet<LeadDetail>(`/leads/${leadId}`, { tenantId });
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setError(null);
    setLead(res.data);
    setNextDraft(toLocalInput(res.data.nextActionAt));
  }, [leadId, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The property's photo and its latest videos, when the lead has one.
  useEffect(() => {
    if (!lead?.propertyId) {
      setProperty(null);
      setVideos([]);
      return;
    }
    void apiGet<PropertyDetail>(`/properties/${lead.propertyId}`, { tenantId }).then((r) => {
      if (r.ok) setProperty(r.data);
    });
    void apiGet<VideoLibraryResponse>(`/videos?propertyId=${lead.propertyId}&pageSize=3`, {
      tenantId,
    }).then((r) => {
      if (r.ok) setVideos(r.data.items);
    });
  }, [lead?.propertyId, tenantId]);

  /** Single field change: status, note, next step. Reloads the lead afterwards. */
  async function patch(body: Record<string, unknown>, done: string) {
    if (!lead) return false;
    setBusy(true);
    const res = await apiPatch<LeadDetail>(`/leads/${lead.id}`, body, { tenantId });
    setBusy(false);
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return false;
    }
    toast.success(done);
    void load();
    return true;
  }

  async function remove() {
    if (!lead) return;
    setBusy(true);
    const res = await apiDelete(`/leads/${lead.id}`, { tenantId });
    setBusy(false);
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      setConfirmDelete(false);
      return;
    }
    toast.success('Lead silindi.');
    router.push(`/w/${slug}/leads`);
  }

  async function saveNoteEdit(noteId: string) {
    if (!lead) return;
    const body = editingText.trim();
    if (!body) return;
    setBusy(true);
    const res = await apiPatch(`/leads/${lead.id}/notes/${noteId}`, { body }, { tenantId });
    setBusy(false);
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    setEditingId(null);
    toast.success('Not güncellendi.');
    void load();
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <Link href={`/w/${slug}/leads`} className="text-sm underline underline-offset-4">
          Leadlere dön
        </Link>
      </div>
    );
  }
  if (!lead) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;

  const isOpen = OPEN.includes(lead.status);
  // Notes and status/edit events in one list, oldest first: the steps of the process.
  const timeline = [
    ...lead.notes.map((n) => ({
      key: `n-${n.id}`,
      kind: 'note' as const,
      id: n.id,
      actor: n.authorName,
      text: n.body,
      createdAt: n.createdAt,
      editedAt: n.editedAt,
      editorName: n.editorName,
      revisionCount: n.revisionCount,
    })),
    ...lead.events.map((e) => ({
      key: `e-${e.id}`,
      kind: 'event' as const,
      id: e.id,
      action: e.action,
      metadata: e.metadata,
      actor: e.actorName,
      text: eventText(e.action, e.metadata),
      createdAt: e.createdAt,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const overdue =
    isOpen && lead.nextActionAt !== null && now > 0 && new Date(lead.nextActionAt).getTime() < now;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/w/${slug}/leads`}
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Leadler
      </Link>

      <section className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {lead.label ?? 'İsimsiz lead'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {now > 0 && (
              <>
                Eklendi: {whenText(lead.createdAt, now)} · son değişiklik:{' '}
                {whenText(lead.updatedAt, now)}
                {isOpen && daysAgo(lead.updatedAt, now) >= 7 && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                    {daysAgo(lead.updatedAt, now)} gündür bekliyor
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Durum"
              value={lead.status}
              onChange={(e) =>
                void patch({ status: e.target.value as LeadStatus }, 'Durum güncellendi.')
              }
            >
              {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon aria-hidden />
              Düzenle
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon aria-hidden />
              Sil
            </Button>
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">Süreç</h2>
              <p className="text-sm text-muted-foreground">
                Her görüşmeyi ya da adımı not olarak ekleyin. Notlar silinmez; yanlış bir not
                yazdıysanız notu düzenleyebilirsiniz; önceki hali Geçmiş'te kalır.
              </p>
            </div>

            {canWrite && (
              <form
                className="flex flex-col gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const body = noteText.trim();
                  if (!body) return;
                  setBusy(true);
                  const res = await apiPost(`/leads/${lead.id}/notes`, { body }, { tenantId });
                  setBusy(false);
                  if (!res.ok) {
                    toast.error(errorMessage(res.error));
                    return;
                  }
                  setNoteText('');
                  toast.success('Not eklendi.');
                  void load();
                }}
              >
                <textarea
                  aria-label="Yeni not"
                  rows={3}
                  maxLength={2000}
                  value={noteText}
                  placeholder="Ne konuşuldu, sonra ne yapılacak?"
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={busy || noteText.trim() === ''}>
                    Notu ekle
                  </Button>
                </div>
              </form>
            )}

            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz adım yok.</p>
            ) : (
              <ol className="relative flex flex-col gap-0 border-l pl-5">
                {timeline.map((item) => (
                  <li key={item.key} className="relative flex flex-col gap-1 pb-5 last:pb-0">
                    <span
                      className={cn(
                        'absolute -left-[34px] top-0 flex size-7 items-center justify-center rounded-full ring-4 ring-card',
                        nodeStyle(item).tone,
                      )}
                      aria-hidden
                    >
                      {(() => {
                        const Icon = nodeStyle(item).Icon;
                        return <Icon className="size-3.5" />;
                      })()}
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {item.actor ?? 'Sistem'} · {formatDateTime(item.createdAt)}
                      </span>
                      {item.kind === 'note' && canWrite && editingId !== item.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingText(item.text);
                          }}
                        >
                          <PencilIcon aria-hidden />
                          Düzenle
                        </Button>
                      )}
                    </div>
                    {item.kind === 'note' && editingId === item.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          aria-label="Notu düzenle"
                          rows={3}
                          maxLength={2000}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            disabled={busy}
                          >
                            Vazgeç
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void saveNoteEdit(item.id)}
                            disabled={busy || editingText.trim() === ''}
                          >
                            Kaydet
                          </Button>
                        </div>
                      </div>
                    ) : item.kind === 'note' ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm leading-relaxed whitespace-pre-line">
                          {item.text}
                        </p>
                        {item.editedAt && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              Düzenlendi · {item.editorName ?? 'Bilinmeyen'} ·{' '}
                              {formatDateTime(item.editedAt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setHistoryFor(item.id)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-foreground hover:bg-accent"
                            >
                              <HistoryIcon className="size-3" aria-hidden />
                              Geçmiş ({item.revisionCount})
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{item.text}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarClockIcon className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-semibold">Sonraki adım</h2>
              {overdue && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-900">
                  Gecikti
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Arama, gezi ya da teklif için bir tarih belirleyin. Tarih gelince burada işaretlenir.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <DateTimePicker
                label="Sonraki adım tarihi"
                value={nextDraft}
                disabled={!canWrite}
                onChange={setNextDraft}
              />
              {canWrite && (
                <>
                  <Button
                    size="sm"
                    disabled={busy || nextDraft === toLocalInput(lead.nextActionAt)}
                    onClick={() =>
                      void patch(
                        { nextActionAt: nextDraft ? new Date(nextDraft).toISOString() : null },
                        'Sonraki adım kaydedildi.',
                      )
                    }
                  >
                    Kaydet
                  </Button>
                  {lead.nextActionAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void patch({ nextActionAt: null }, 'Sonraki adım kaldırıldı.')}
                    >
                      Kaldır
                    </Button>
                  )}
                </>
              )}
            </div>
            {lead.nextActionAt && (
              <p className={cn('text-xs', overdue ? 'text-red-700' : 'text-muted-foreground')}>
                {formatDateTime(lead.nextActionAt)}
              </p>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">İlgilendiği mülk</h2>
            {lead.propertyId && lead.propertyTitle ? (
              <>
                <Link
                  href={`/w/${slug}/properties/${lead.propertyId}`}
                  className="group flex flex-col gap-3"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                    {property?.assets[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed URL
                      <img
                        src={property.assets[0].thumbnailUrl}
                        alt=""
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Building2Icon className="size-6" aria-hidden />
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium group-hover:underline">
                    {lead.propertyTitle}
                  </span>
                </Link>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Mülkün videoları</span>
                    <Link
                      href={`/w/${slug}/properties/${lead.propertyId}?tab=videolar`}
                      className="text-xs text-muted-foreground underline underline-offset-4"
                    >
                      Tümü
                    </Link>
                  </div>
                  {videos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Bu mülk için henüz video yok.</p>
                  ) : (
                    <ul className="grid grid-cols-3 gap-2">
                      {videos.map((v) => (
                        <li key={v.generationId}>
                          <Link
                            href={`/w/${slug}/properties/${lead.propertyId}?tab=videolar`}
                            className="group relative block aspect-video overflow-hidden rounded-md bg-muted"
                            aria-label="Videoyu aç"
                          >
                            {v.thumbnailUrl && (
                              // eslint-disable-next-line @next/next/no-img-element -- signed URL
                              <img src={v.thumbnailUrl} alt="" className="size-full object-cover" />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                              <PlayIcon
                                className="size-5 text-white opacity-0 group-hover:opacity-100"
                                aria-hidden
                              />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Mülk belirtilmemiş.</p>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Bilgiler</h2>
            <dl className="flex flex-col text-sm">
              <div className="flex justify-between gap-4 border-b py-2">
                <dt className="text-muted-foreground">E-posta</dt>
                <dd className="min-w-0 truncate font-medium">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-violet-700 hover:text-violet-900"
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b py-2">
                <dt className="text-muted-foreground">Telefon</dt>
                <dd className="font-medium">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                      className="text-violet-700 hover:text-violet-900"
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b py-2">
                <dt className="text-muted-foreground">Kaynak</dt>
                <dd className="font-medium">{LEAD_SOURCE_LABELS[lead.source]}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b py-2">
                <dt className="text-muted-foreground">Durum</dt>
                <dd className="font-medium">{LEAD_STATUS_LABELS[lead.status]}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b py-2">
                <dt className="text-muted-foreground">Eklenme</dt>
                <dd className="font-medium">{formatDateTime(lead.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Son güncelleme</dt>
                <dd className="font-medium">{formatDateTime(lead.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      {editing && (
        <LeadFormDialog
          tenantId={tenantId}
          slug={slug}
          lead={lead}
          properties={properties}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}

      {historyFor && (
        <NoteHistoryDialog
          tenantId={tenantId}
          leadId={lead.id}
          noteId={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Lead silinsin mi?"
        description="Bu lead ve geçmişi kalıcı olarak silinir. Bu işlem geri alınamaz."
        confirmLabel="Evet, sil"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
