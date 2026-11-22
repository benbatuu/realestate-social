'use client';

import type { NotificationView } from '@app/shared';
import { BellIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface NotificationList {
  items: NotificationView[];
  total: number;
  unread: number;
}

const PREVIEW = 3;
const POLL_MS = 30_000;

/** Header bell: unread count, the newest three notices, and a link to the full page. */
export function NotificationBell({ tenantId, slug }: { tenantId: string; slug: string }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationView[]>([]);

  const refreshCount = useCallback(async () => {
    const res = await apiGet<{ unread: number }>('/notifications/unread-count', { tenantId });
    if (res.ok) setUnread(res.data.unread);
  }, [tenantId]);

  const loadPreview = useCallback(async () => {
    const res = await apiGet<NotificationList>(`/notifications?page=1&pageSize=${PREVIEW}`, {
      tenantId,
    });
    if (res.ok) {
      setItems(res.data.items);
      setUnread(res.data.unread);
    }
  }, [tenantId]);

  useEffect(() => {
    void refreshCount();
    const t = setInterval(() => void refreshCount(), POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    void loadPreview();
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
  }, [open, loadPreview]);

  async function openItem(n: NotificationView) {
    if (!n.read) await apiPost(`/notifications/${n.id}/read`, {}, { tenantId });
    setOpen(false);
    if (n.link) router.push(`/w/${slug}${n.link}`);
    void refreshCount();
  }

  const badge = unread > 9 ? '9+' : String(unread);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
        aria-expanded={open}
        className="relative inline-flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-accent"
      >
        <BellIcon className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className="absolute top-full right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border bg-popover shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Bildirimler</span>
            {unread > 0 && (
              <span className="text-xs text-muted-foreground">{unread} okunmamış</span>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Henüz bildirim yok.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.read ? 'bg-transparent' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={cn('truncate text-sm', !n.read && 'font-semibold')}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="truncate text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t p-2">
            <Link
              href={`/w/${slug}/notifications`}
              onClick={() => setOpen(false)}
              className="flex h-8 w-full items-center justify-center rounded-lg text-sm font-medium hover:bg-accent"
            >
              Tüm bildirimleri gör
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
