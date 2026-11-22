'use client';

import type { AssetUploadResponse, PropertyAsset } from '@app/shared';
import { ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, Trash2Icon } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiDelete, apiPatch, apiUpload } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';

const ACCEPT = 'image/jpeg,image/png,image/webp';

export function PhotoGallery({
  tenantId,
  propertyId,
  title,
  assets,
  editable,
}: {
  tenantId: string;
  propertyId: string;
  title: string;
  assets: PropertyAsset[];
  editable: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setProgress({ done: 0, total: files.length });
    let created = 0;
    const problems: string[] = [];
    // One file per request keeps each request small and gives real progress.
    for (const [i, file] of files.entries()) {
      const form = new FormData();
      form.append('files', file);
      const res = await apiUpload<AssetUploadResponse>(`/properties/${propertyId}/assets`, form, {
        tenantId,
      });
      if (!res.ok) {
        problems.push(`${file.name}: ${errorMessage(res.error)}`);
      } else {
        for (const r of res.data.results) {
          if (r.outcome === 'created') created++;
          else problems.push(`${file.name}: ${r.reason ?? 'Yüklenemedi.'}`);
        }
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (created > 0) toast.success(`${created} fotoğraf eklendi.`);
    for (const p of problems.slice(0, 5)) toast.error(p);
    if (problems.length > 5) toast.error(`${problems.length - 5} dosya daha eklenemedi.`);
    router.refresh();
  }

  /** Moves a photo one place. The whole order is sent, so the server checks it is complete. */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= assets.length) return;
    const ids = assets.map((a) => a.id);
    [ids[index], ids[target]] = [ids[target] ?? '', ids[index] ?? ''];
    const res = await apiPatch(
      `/properties/${propertyId}/assets/order`,
      { assetIds: ids },
      { tenantId },
    );
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    router.refresh();
  }

  async function remove(asset: PropertyAsset) {
    setDeleting(asset.id);
    const res = await apiDelete(`/properties/${propertyId}/assets/${asset.id}`, { tenantId });
    setDeleting(null);
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {assets.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a, i) => (
            <li
              key={a.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-md bg-muted"
            >
              <a href={a.url} target="_blank" rel="noreferrer" className="block size-full">
                <Image
                  src={a.thumbnailUrl}
                  alt={`${title} — fotoğraf ${i + 1}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                />
              </a>
              {i === 0 && (
                <span className="absolute top-2 left-2 rounded bg-background/90 px-1.5 py-0.5 text-xs font-medium">
                  Kapak
                </span>
              )}
              {editable && (
                <div className="absolute bottom-2 left-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Fotoğraf ${i + 1} öne al`}
                  >
                    <ChevronLeftIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    disabled={i === assets.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Fotoğraf ${i + 1} arkaya al`}
                  >
                    <ChevronRightIcon aria-hidden />
                  </Button>
                </div>
              )}
              {editable && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Fotoğraf ${i + 1}'i sil`}
                  disabled={deleting === a.id}
                  onClick={() => remove(a)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Henüz fotoğraf yok.</p>
      )}

      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(Array.from(e.dataTransfer.files));
          }}
          className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors ${dragging ? 'border-primary bg-accent' : ''}`}
        >
          <ImagePlusIcon className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm">
            Fotoğrafları buraya sürükleyin ya da{' '}
            <button
              type="button"
              className="font-medium underline underline-offset-4"
              onClick={() => input.current?.click()}
              disabled={progress !== null}
            >
              dosya seçin
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG ya da WebP · dosya başına en fazla 20 MB
          </p>
          {progress && (
            <p className="text-sm font-medium" role="status">
              Yükleniyor… {progress.done}/{progress.total}
            </p>
          )}
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            aria-label="Fotoğraf seç"
            onChange={(e) => {
              void upload(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}
