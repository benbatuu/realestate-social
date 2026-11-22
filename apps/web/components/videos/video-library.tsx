'use client';

import type { VideoLibraryItem, VideoLibraryResponse } from '@app/shared';
import { ArrowLeftIcon, FilmIcon, FolderIcon, SearchIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { apiGet } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatBytes, formatDateTime } from '@/lib/format';
import { FolderEditDialog, type FolderEditTarget } from './folder-edit-dialog';
import { VideoLightbox } from './video-lightbox';

interface Folder {
  customCover: string | null;
  propertyId: string;
  title: string;
  /** First video thumbnail, which is the property's first photo. */
  cover: string | null;
  count: number;
  latest: string | null;
}

/** One folder per property, newest activity first. */
function toFolders(items: VideoLibraryItem[]): Folder[] {
  const map = new Map<string, Folder>();
  for (const item of items) {
    let folder = map.get(item.propertyId);
    if (!folder) {
      folder = {
        propertyId: item.propertyId,
        title: item.propertyTitle,
        customCover: item.folderCoverUrl,
        cover: item.folderCoverUrl ?? item.thumbnailUrl,
        count: 0,
        latest: null,
      };
      map.set(item.propertyId, folder);
    }
    folder.count += 1;
    if (!folder.cover && item.thumbnailUrl) folder.cover = item.thumbnailUrl;
    if (item.completedAt && (!folder.latest || item.completedAt > folder.latest)) {
      folder.latest = item.completedAt;
    }
  }
  return [...map.values()];
}

/**
 * Videos of the workspace, Drive-style: one folder per property. Double-click (or Enter)
 * opens a folder and shows only that property's videos.
 */
export function VideoLibrary({
  tenantId,
  properties,
  canEdit,
}: {
  tenantId: string;
  properties: { id: string; title: string }[];
  /** Viewers browse the library but cannot rename folders or change covers. */
  canEdit: boolean;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<VideoLibraryItem[]>([]);
  const [meta, setMeta] = useState<Pick<VideoLibraryResponse, 'total' | 'storageBytes'>>({
    total: 0,
    storageBytes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<VideoLibraryItem | null>(null);
  const [editing, setEditing] = useState<FolderEditTarget | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (propertyId) p.set('propertyId', propertyId);
    if (q.trim()) p.set('q', q.trim());
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p;
  }, [propertyId, q, from, to]);

  // Filter changes start again from page one.
  useEffect(() => setPage(1), [query]);

  const load = useCallback(
    async (pageNo: number, append: boolean) => {
      setLoading(true);
      const p = new URLSearchParams(query);
      p.set('page', String(pageNo));
      const res = await apiGet<VideoLibraryResponse>(`/videos?${p.toString()}`, { tenantId });
      setLoading(false);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      setError(null);
      setMeta({ total: res.data.total, storageBytes: res.data.storageBytes });
      setItems((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
    },
    [query, tenantId],
  );

  useEffect(() => {
    void load(page, page > 1);
  }, [page, load]);

  const folders = useMemo(() => toFolders(items), [items]);
  const hasMore = items.length < meta.total;
  const searching = Boolean(q.trim() || from || to);
  const openTitle = propertyId
    ? (properties.find((p) => p.id === propertyId)?.title ?? folders[0]?.title ?? 'Mülk')
    : null;

  function openFolder(id: string) {
    setPropertyId(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Videolar</h1>
          <p className="text-sm text-muted-foreground">
            {meta.total} video · {folders.length} klasör · kullanılan alan{' '}
            {formatBytes(meta.storageBytes)}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="relative min-w-56 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mülk adına göre ara"
            aria-label="Videolarda ara"
            className="pl-8"
          />
        </div>
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          aria-label="Klasör"
          className="w-64 max-w-full"
        >
          <option value="">Tüm klasörler</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <DateRangePicker
          value={{ from, to }}
          onChange={(r) => {
            setFrom(r.from);
            setTo(r.to);
          }}
          label="Tarih aralığı"
          align="right"
        />
      </div>

      {openTitle && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => openFolder('')}>
            <ArrowLeftIcon aria-hidden />
            Klasörler
          </Button>
          <nav aria-label="Konum" className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-muted-foreground">Videolar</span>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-medium">{openTitle}</span>
          </nav>
        </div>
      )}

      <FormError message={error} />

      {!loading && items.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
            <FilmIcon className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">
              {searching || propertyId ? 'Sonuç bulunamadı' : 'Henüz video yok'}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {searching || propertyId
                ? 'Aramanızı ya da filtreleri değiştirin.'
                : 'Mülk sayfasından video ürettiğinizde burada klasörler halinde görünür.'}
            </p>
          </div>
        </div>
      ) : propertyId ? (
        <ul
          className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
          aria-busy={loading}
          aria-label={`${openTitle} videoları`}
        >
          {items.map((item) => (
            <VideoCard key={item.generationId} item={item} onOpen={() => setOpen(item)} />
          ))}
        </ul>
      ) : (
        <ul
          className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
          aria-busy={loading}
          aria-label="Klasörler"
        >
          {folders.map((folder) => {
            return (
              <li key={folder.propertyId} className="group/folder relative">
                <button
                  type="button"
                  onClick={() => openFolder(folder.propertyId)}
                  aria-label={`${folder.title} klasörü, ${folder.count} video`}
                  className="group flex w-full flex-col overflow-hidden rounded-xl bg-card text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    {folder.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed URL, changes every request
                      <img
                        src={folder.cover}
                        alt=""
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <FolderIcon className="size-10" aria-hidden />
                      </div>
                    )}
                    <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium tabular-nums">
                      <FilmIcon className="size-3" aria-hidden />
                      {folder.count}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-3">
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{folder.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {folder.latest
                          ? `Son ${formatDateTime(folder.latest)}`
                          : `${folder.count} video`}
                      </span>
                    </span>
                  </div>
                </button>
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2 z-10 opacity-100 shadow-sm sm:opacity-0 sm:group-hover/folder:opacity-100 sm:focus-visible:opacity-100"
                    onClick={() =>
                      setEditing({
                        propertyId: folder.propertyId,
                        title: folder.title,
                        cover: folder.cover,
                        customCover: folder.customCover,
                      })
                    }
                  >
                    Düzenle
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Daha fazla göster'}
          </Button>
        </div>
      )}

      {open && <VideoLightbox item={open} onClose={() => setOpen(null)} />}

      {editing && (
        <FolderEditDialog
          tenantId={tenantId}
          folder={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            // Stay on the same folder; the list picks up the new name and cover.
            void load(1, false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function VideoCard({ item, onOpen }: { item: VideoLibraryItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="relative aspect-video w-full bg-muted">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, changes every request
            <img src={item.thumbnailUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <FilmIcon className="size-6" aria-hidden />
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex gap-1">
            {item.formats.map((f) => (
              <span
                key={f.format}
                className="rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-medium"
              >
                {f.format === 'PORTRAIT_9_16' ? 'Dikey' : 'Yatay'}
              </span>
            ))}
          </div>
          {item.isMock && (
            <span className="absolute top-2 right-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
              Taslak
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 p-3">
          <span className="text-xs text-muted-foreground">
            {item.completedAt ? formatDateTime(item.completedAt) : ''}
          </span>
          <span className="text-sm font-medium tabular-nums">
            {item.durationSeconds} sn · Üretim #{item.generationNumber}
          </span>
        </div>
      </button>
    </li>
  );
}
