'use client';

import type { PropertyDetail } from '@app/shared';
import { ImagePlusIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiDelete, apiGet, apiPatch, apiUpload } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export interface FolderEditTarget {
  propertyId: string;
  title: string;
  /** What the folder shows now: custom cover, or the first video thumbnail. */
  cover: string | null;
  /** The custom cover only, if one is set. */
  customCover: string | null;
}

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Drive-style folder settings: name, cover upload, and cover picked from the property's
 * photos. A custom popup (no browser dialogs).
 */
export function FolderEditDialog({
  tenantId,
  folder,
  onClose,
  onChanged,
}: {
  tenantId: string;
  folder: FolderEditTarget;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(folder.title);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    void apiGet<PropertyDetail>(`/properties/${folder.propertyId}`, { tenantId }).then((res) => {
      if (res.ok) {
        setPhotos(res.data.assets.map((a) => ({ id: a.id, url: a.thumbnailUrl })));
      }
    });
  }, [folder.propertyId, tenantId]);

  /** Every change ends the same way: the library is refreshed and the sidebar too. */
  function done(message: string) {
    toast.success(message);
    onChanged();
    router.refresh();
  }

  async function saveName() {
    setError(null);
    const next = name.trim();
    if (next.length < 2) {
      setError('Klasör adı en az 2 karakter olmalı.');
      return;
    }
    if (next === folder.title) return;
    setBusy('name');
    const res = await apiPatch(`/properties/${folder.propertyId}`, { title: next }, { tenantId });
    setBusy(null);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    done('Klasör adı güncellendi.');
  }

  async function uploadCover(file: File) {
    setError(null);
    setBusy('upload');
    const form = new FormData();
    form.append('file', file);
    const res = await apiUpload(`/properties/${folder.propertyId}/folder-cover`, form, {
      tenantId,
    });
    setBusy(null);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    done('Kapak fotoğrafı yüklendi.');
  }

  async function pickPhoto(assetId: string) {
    setError(null);
    setBusy(`photo:${assetId}`);
    const res = await apiPatch(
      `/properties/${folder.propertyId}/folder-cover/from-photo/${assetId}`,
      {},
      { tenantId },
    );
    setBusy(null);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    done('Kapak seçildi.');
  }

  async function resetCover() {
    setError(null);
    setBusy('reset');
    const res = await apiDelete(`/properties/${folder.propertyId}/folder-cover`, { tenantId });
    setBusy(null);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    done('Varsayılan kapak geri geldi.');
  }

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
        aria-labelledby="folder-edit-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="folder-edit-title" className="text-base font-semibold">
            Klasörü düzenle
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Kapat">
            <XIcon aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto p-5">
          <FormError message={error} />

          <section className="flex flex-col gap-2">
            <label htmlFor="folder-name" className="text-sm font-medium">
              Klasör adı
            </label>
            <div className="flex gap-2">
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName();
                }}
              />
              <Button
                onClick={() => void saveName()}
                disabled={busy !== null || name.trim() === folder.title}
              >
                {busy === 'name' ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Klasör adı mülkün başlığıdır; burada değişince mülkte de değişir.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Kapak</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy !== null}
                >
                  <ImagePlusIcon aria-hidden />
                  {busy === 'upload' ? 'Yükleniyor…' : 'Fotoğraf yükle'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void resetCover()}
                  disabled={busy !== null || !folder.customCover}
                >
                  <RotateCcwIcon aria-hidden />
                  Varsayılan
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  hidden
                  aria-label="Kapak fotoğrafı seç"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void uploadCover(file);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="aspect-[4/3] w-40 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {folder.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL, changes every request
                  <img src={folder.cover} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Yüklediğiniz ya da seçtiğiniz fotoğraf klasör kapağı olur. Mülkün fotoğraflarına
                dokunmaz.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Mülk fotoğraflarından seç</span>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu mülkte fotoğraf yok.</p>
              ) : (
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {photos.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => void pickPhoto(p.id)}
                        disabled={busy !== null}
                        aria-label="Bu fotoğrafı kapak yap"
                        className={cn(
                          'relative aspect-[4/3] w-full overflow-hidden rounded-md ring-2 ring-transparent transition hover:ring-primary focus-visible:ring-primary focus-visible:outline-none disabled:opacity-60',
                          busy === `photo:${p.id}` && 'ring-primary',
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                        <img src={p.url} alt="" className="size-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
