'use client';

import type { NotificationPreference, NotificationView } from '@app/shared';
import { BellIcon, SearchIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { apiGet, apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Page {
  items: NotificationView[];
  total: number;
  unread: number;
}

const PAGE_SIZES = ['10', '25', '50', '100', '1000'];

/** Every notice of the signed-in member in this workspace. Search, filters and paging like the other tables. */
export function NotificationsView({ tenantId, slug }: { tenantId: string; slug: string }) {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [kinds, setKinds] = useState<NotificationPreference[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [read, setRead] = useState<'all' | 'unread' | 'read'>('all');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('25');
  const [selected, setSelected] = useState<NotificationView | null>(null);

  useEffect(() => {
    void apiGet<NotificationPreference[]>('/notifications/preferences', { tenantId }).then(
      (res) => {
        if (res.ok) setKinds(res.data);
      },
    );
  }, [tenantId]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize });
    if (q.trim()) params.set('q', q.trim());
    if (read !== 'all') params.set('read', read);
    if (kind) params.set('kind', kind);
    const res = await apiGet<Page>(`/notifications?${params}`, { tenantId });
    setLoading(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setError(null);
    setTotal(res.data.total);
    setUnread(res.data.unread);
    setItems(res.data.items);
  }, [tenantId, page, pageSize, q, read, kind]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function markAll() {
    const res = await apiPost('/notifications/read-all', {}, { tenantId });
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    void load();
  }

  async function open(n: NotificationView) {
    setSelected(n);
    if (!n.read) {
      await apiPost(`/notifications/${n.id}/read`, {}, { tenantId });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
  }

  const labelOf = (k: string) => kinds.find((p) => p.kind === k)?.label ?? k;
  const filtered = Boolean(q.trim() || read !== 'all' || kind);

  const columns: DataColumn<NotificationView>[] = [
    {
      id: 'title',
      header: 'Bildirim',
      cell: (n) => (
        <button
          type="button"
          onClick={() => void open(n)}
          className="flex w-full min-w-0 items-start gap-3 text-left"
        >
          <span
            className={cn(
              'mt-1.5 size-2 shrink-0 rounded-full',
              n.read ? 'bg-transparent' : 'bg-primary',
            )}
            aria-hidden
          />
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate text-sm', !n.read && 'font-semibold')}>{n.title}</span>
            {n.body && <span className="truncate text-xs text-muted-foreground">{n.body}</span>}
          </span>
        </button>
      ),
    },
    {
      id: 'kind',
      header: 'Tür',
      hideBelow: 'md',
      cell: (n) => <span className="text-sm text-muted-foreground">{labelOf(n.kind)}</span>,
    },
    {
      id: 'date',
      header: 'Tarih',
      cell: (n) => (
        <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
          {formatDateTime(n.createdAt)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Durum',
      hideBelow: 'sm',
      cell: (n) => (
        <span
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium',
            n.read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          {n.read ? 'Okundu' : 'Okunmadı'}
        </span>
      ),
    },
    {
      id: 'open',
      header: '',
      align: 'right',
      width: '1%',
      cell: (n) =>
        n.details ? (
          <Button variant="outline" size="sm" onClick={() => void open(n)}>
            Detay
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Bildirimler</h1>
          <p className="text-sm text-muted-foreground">
            {total} bildirim{unread > 0 ? ` · ${unread} okunmamış` : ''}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={() => void markAll()}>
            Tümünü okundu işaretle
          </Button>
        )}
      </section>

      <FormError message={error} />

      <DataTable
        label="Bildirimler"
        rows={items}
        rowKey={(n) => n.id}
        columns={columns}
        toolbar={
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="relative min-w-56 flex-1">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="Bildirimlerde ara"
                placeholder="Başlık veya metin ara"
                className="pl-8"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <NativeSelect
              aria-label="Durum"
              className="w-44"
              value={read}
              onChange={(e) => {
                setRead(e.target.value as 'all' | 'unread' | 'read');
                setPage(1);
              }}
            >
              <option value="all">Tüm durumlar</option>
              <option value="unread">Okunmamış</option>
              <option value="read">Okunmuş</option>
            </NativeSelect>
            <NativeSelect
              aria-label="Tür"
              className="w-56"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tüm türler</option>
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </NativeSelect>
            {filtered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setQ('');
                  setRead('all');
                  setKind('');
                  setPage(1);
                }}
              >
                <XIcon aria-hidden />
                Filtreleri temizle
              </Button>
            )}
          </div>
        }
        empty={
          loading ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Yükleniyor…
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-20 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
                <BellIcon className="size-5" aria-hidden />
              </span>
              <p className="font-medium">{filtered ? 'Sonuç bulunamadı' : 'Henüz bildirim yok'}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {filtered
                  ? 'Aramanızı ya da filtreleri değiştirin.'
                  : 'Video hazır olduğunda, içe aktarma bittiğinde ya da ekipte bir değişiklik olduğunda burada görünür.'}
              </p>
            </div>
          )
        }
        pagination={{
          page,
          pageSize,
          total,
          pageSizes: PAGE_SIZES,
          defaultPageSize: '25',
          unit: 'bildirim',
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
      />

      {selected && (
        <NotificationDialog notification={selected} slug={slug} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function NotificationDialog({
  notification: n,
  slug,
  onClose,
}: {
  notification: NotificationView;
  slug: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="notification-title" className="text-base font-semibold">
            {n.title}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Kapat">
            <XIcon aria-hidden />
          </Button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-5 text-sm">
          {n.body && <p>{n.body}</p>}
          <dl className="flex flex-col divide-y rounded-lg border">
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">Tarih</dt>
              <dd className="tabular-nums">{formatDateTime(n.createdAt)}</dd>
            </div>
            {(n.details ?? []).map((d) => (
              <div key={d.label} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="text-right">{d.value}</dd>
              </div>
            ))}
          </dl>
          {n.link && (
            <Link
              href={`/w/${slug}${n.link}`}
              onClick={onClose}
              className="w-fit text-sm font-medium underline underline-offset-4"
            >
              Sayfaya git
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
