'use client';

import type { CreditBalance, VideoGeneration, VideoOutput } from '@app/shared';
import { DownloadIcon, FilmIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormError } from '@/components/auth/form-error';
import { GenerationSteps } from '@/components/properties/generation-steps';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

const STAGE_LABEL: Record<string, string> = {
  QUEUED: 'Sırada',
  VALIDATING: 'Mülk bilgileri kontrol ediliyor',
  ANALYZING_PHOTOS: 'Fotoğraflar analiz ediliyor',
  PLANNING_SCENES: 'Sahneler planlanıyor',
  GENERATING_SCRIPT: 'Senaryo hazırlanıyor',
  GENERATING_AI_SCENES: 'Hareketli sahneler üretiliyor',
  GENERATING_VOICE: 'Seslendirme hazırlanıyor',
  SELECTING_MUSIC: 'Müzik seçiliyor',
  COMPOSING_VIDEO: 'Video birleştiriliyor',
  RENDERING: 'Dosyalar oluşturuluyor',
  QUALITY_CHECK: 'Kalite kontrolü',
  COMPLETED: 'Tamamlandı',
  FAILED: 'Başarısız',
};

const FORMAT_LABEL: Record<VideoOutput['format'], string> = {
  PORTRAIT_9_16: 'Dikey (9:16)',
  LANDSCAPE_16_9: 'Yatay (16:9)',
};

/** Regeneration is free once per project while the monthly free pool has a seat. */
interface RegenInfo {
  free: boolean;
}

/** Starts a video, follows its real stage and progress, and offers the finished files. */
export function VideoPanel({
  tenantId,
  propertyId,
  photoCount,
  slug,
  photos,
  canCreate,
}: {
  tenantId: string;
  propertyId: string;
  photoCount: number;
  slug: string;
  photos: { id: string; url: string }[];
  /** Viewers can see videos but cannot start one. */
  canCreate: boolean;
}) {
  const [generation, setGeneration] = useState<VideoGeneration | null>(null);
  const [outputs, setOutputs] = useState<VideoOutput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [regen, setRegen] = useState<RegenInfo | null>(null);
  const router = useRouter();

  // When a run ends, capture or release changes the balance; refresh the sidebar too.
  useEffect(() => {
    if (generation?.stage === 'COMPLETED' || generation?.stage === 'FAILED') router.refresh();
  }, [generation?.stage, router]);

  // Restore the latest run after a reload: finished videos stay visible, running ones resume.
  useEffect(() => {
    void apiGet<VideoGeneration | null>(`/properties/${propertyId}/video-generations/latest`, {
      tenantId,
    }).then((res) => {
      if (res.ok && res.data) setGeneration(res.data);
    });
  }, [propertyId, tenantId]);

  // Poll the real stored state until the run is finished.
  useEffect(() => {
    if (!generation || generation.stage === 'COMPLETED' || generation.stage === 'FAILED') return;
    const timer = setTimeout(async () => {
      const res = await apiGet<VideoGeneration>(`/video-generations/${generation.id}`, {
        tenantId,
      });
      if (res.ok) setGeneration(res.data);
    }, 2000);
    return () => clearTimeout(timer);
  }, [generation, tenantId]);

  useEffect(() => {
    if (generation?.stage !== 'COMPLETED') return;
    void apiGet<VideoOutput[]>(`/video-generations/${generation.id}/outputs`, { tenantId }).then(
      (res) => {
        if (res.ok) setOutputs(res.data);
      },
    );
  }, [generation?.id, generation?.stage, tenantId]);

  // Tells the user what the next "Yeniden üret" costs: free pool seat or one credit.
  useEffect(() => {
    if (!generation) return;
    let cancelled = false;
    void Promise.all([
      apiGet<CreditBalance>('/credits', { tenantId }),
      apiGet<{ freeRegenerationUsed: boolean }>(`/video-projects/${generation.videoProjectId}`, {
        tenantId,
      }),
    ]).then(([credits, project]) => {
      if (cancelled || !credits.ok || !project.ok) return;
      const seatLeft = credits.data.freeRegenerations.available >= 1;
      setRegen({ free: seatLeft && !project.data.freeRegenerationUsed });
    });
    return () => {
      cancelled = true;
    };
  }, [generation?.videoProjectId, generation?.id, tenantId]);

  async function start() {
    setBusy(true);
    setError(null);
    setOutputs([]);
    // A new key per click; a retried request with the same key cannot charge twice.
    const key = crypto.randomUUID();
    const headers = { 'Idempotency-Key': key };
    // Existing project: a regeneration in the same project (free once, then 1 credit).
    // No project yet: create the project with its first generation.
    if (generation) {
      const res = await apiPost<VideoGeneration>(
        `/video-projects/${generation.videoProjectId}/generations`,
        {},
        { tenantId, headers },
      );
      setBusy(false);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      setGeneration(res.data);
    } else {
      const res = await apiPost<{ generations: VideoGeneration[] }>(
        `/properties/${propertyId}/video-projects`,
        {},
        { tenantId, headers },
      );
      setBusy(false);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      const first = res.data.generations[0];
      if (first) setGeneration(first);
    }
    // Reserved credits show in the sidebar; refresh server data so it drops now.
    router.refresh();
  }

  const running =
    generation !== null && generation.stage !== 'COMPLETED' && generation.stage !== 'FAILED';
  const done = generation?.stage === 'COMPLETED';
  const failed = generation?.stage === 'FAILED';
  const hasVideo = done && outputs.length > 0;

  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FilmIcon className="size-4" aria-hidden />
            Videolar
            {generation && (
              <Badge variant={failed ? 'destructive' : done ? 'default' : 'secondary'}>
                {STAGE_LABEL[generation.stage] ?? generation.stage}
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Fotoğraflardan dikey ve yatay video üretilir. Yeni video 1 kredi harcar; her projede ilk
            yeniden üretim ücretsiz havuzdan düşer.
          </p>
        </div>

        {!running && canCreate && (
          <div className="flex flex-col items-end gap-1">
            <Button onClick={start} disabled={busy || photoCount === 0}>
              <SparklesIcon aria-hidden />
              {busy
                ? 'Başlatılıyor…'
                : generation
                  ? regen
                    ? regen.free
                      ? 'Yeniden üret · Ücretsiz'
                      : 'Yeniden üret · 1 kredi'
                    : 'Yeniden üret'
                  : 'Video üret · 1 kredi'}
            </Button>
            {generation && regen && (
              <span className="text-xs text-muted-foreground">
                {regen.free
                  ? 'Bu yeniden üretim ücretsiz hakkınızdan düşer.'
                  : 'Ücretsiz hakkınız kullanıldı; bu üretim 1 krediden düşer.'}
              </span>
            )}
          </div>
        )}
      </div>

      <FormError message={error} />

      {photoCount === 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Video için önce en az bir fotoğraf ekleyin.
        </p>
      )}

      {running && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <GenerationSteps
            stage={generation.stage}
            progress={generation.progress}
            photos={photos}
          />
        </div>
      )}

      {failed && <FormError message={generation.failureMessage ?? 'Video üretilemedi.'} />}

      {done && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Bu dosyalar taslaktır: klipler ve ses henüz gerçek sağlayıcıdan gelmiyor olabilir.
        </p>
      )}

      {hasVideo && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {outputs.map((o) => (
            <li key={o.format} className="flex flex-col gap-3 rounded-lg border p-3">
              <div
                className={cn(
                  'mx-auto w-full overflow-hidden rounded-md bg-black',
                  o.format === 'PORTRAIT_9_16' ? 'aspect-[9/16] max-h-96' : 'aspect-video',
                )}
              >
                <video
                  src={o.downloadUrl}
                  controls
                  playsInline
                  className="size-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{FORMAT_LABEL[o.format]}</span>
                  <span className="text-xs text-muted-foreground">{o.durationSeconds} sn</span>
                </div>
                <a
                  href={o.downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  <DownloadIcon className="size-4" aria-hidden />
                  İndir
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done && (
        <Link
          href={`/w/${slug}/videos`}
          className="w-fit text-xs text-muted-foreground underline underline-offset-4"
        >
          Tüm videolar
        </Link>
      )}

      {!generation && photoCount > 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
          <FilmIcon className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Henüz video yok</p>
          <p className="text-xs text-muted-foreground">
            Üretilen videolar burada görünür ve indirilebilir.
          </p>
        </div>
      )}
    </section>
  );
}
