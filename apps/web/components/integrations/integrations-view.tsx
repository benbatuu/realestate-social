'use client';

import type { IntegrationConnection, IntegrationsResponse, IntegrationProvider } from '@app/shared';
import {
  CircleDashedIcon,
  FileSpreadsheetIcon,
  PauseIcon,
  PlayIcon,
  PlugIcon,
  PlusIcon,
  RefreshCwIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LeadPilotDialog } from './leadpilot-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const STATUS_LABEL: Record<IntegrationConnection['status'], string> = {
  PENDING: 'Doğrulama bekliyor',
  ACTIVE: 'Aktif',
  DISABLED: 'Duraklatıldı',
};

const STATUS_TONE: Record<IntegrationConnection['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  ACTIVE: 'bg-emerald-100 text-emerald-900',
  DISABLED: 'bg-muted text-muted-foreground',
};

const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  LEADPILOT: 'LeadPilot',
  GENERIC_REST: 'REST API',
  CSV: 'Dosya (CSV / Excel)',
};

/** Catalog: every source we support or plan to. Only LeadPilot connects here for now. */
const CATALOG: {
  key: string;
  name: string;
  description: string;
  state: 'connect' | 'file' | 'soon';
  badge?: string;
}[] = [
  {
    key: 'leadpilot',
    name: 'LeadPilot',
    description:
      'Kendi CRM’imiz. Portföy ve lead verisini otomatik alır, lead durumlarını takip eder.',
    state: 'connect',
    badge: 'Önerilen',
  },
  {
    key: 'file',
    name: 'Dosya (CSV / Excel)',
    description: 'CRM’inizden dışa aktardığınız listeyi yükleyin. Her zaman kullanılabilir.',
    state: 'file',
    badge: 'Hazır',
  },
  {
    key: 'rest',
    name: 'REST API',
    description: 'Kendi yazılımınızdan veri göndermek için genel bağlantı.',
    state: 'soon',
    badge: 'Yakında',
  },
  {
    key: 'others',
    name: 'Diğer CRM’ler',
    description: 'Yeni CRM entegrasyonları aynı bağlantı yapısını kullanacak.',
    state: 'soon',
    badge: 'Yakında',
  },
];

export function IntegrationsView({
  tenantId,
  slug,
  canManage,
}: {
  tenantId: string;
  slug: string;
  canManage: boolean;
}) {
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [removing, setRemoving] = useState<IntegrationConnection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiGet<IntegrationsResponse>('/integrations', { tenantId });
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setError(null);
    setData(res.data);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While a sync runs, refresh every two seconds so the step shown is the current one.
  const anyRunning = (data?.connections ?? []).some((c) => c.lastRun?.status === 'RUNNING');
  useEffect(() => {
    if (!anyRunning) return;
    const t = setTimeout(() => void load(), 2000);
    return () => clearTimeout(t);
  }, [anyRunning, load, data]);

  async function syncNow(c: IntegrationConnection) {
    const res = await apiPost(`/integrations/connections/${c.id}/sync`, {}, { tenantId });
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    toast.success('Senkron başlatıldı. Birkaç dakika içinde mülkler güncellenir.');
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const res = await apiDelete(`/integrations/connections/${removing.id}`, { tenantId });
    setBusy(false);
    setRemoving(null);
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    toast.success('Bağlantı kaldırıldı.');
    void load();
  }

  async function toggle(c: IntegrationConnection) {
    const enabled = c.status === 'DISABLED';
    const res = await apiPatch(`/integrations/connections/${c.id}`, { enabled }, { tenantId });
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    toast.success(enabled ? 'Bağlantı yeniden etkin.' : 'Bağlantı duraklatıldı.');
    void load();
  }

  const connections = data?.connections ?? [];
  const usage = data?.usage;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">CRM bağlantıları</h1>
          <p className="text-sm text-muted-foreground">
            Portföy ve lead verisini CRM’inizden otomatik alın. Her bağlantı aynı yapıyla çalışır.
          </p>
        </div>
        {usage && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm shadow-sm">
            <span className="text-muted-foreground">Bağlantı</span>
            <span className="font-semibold tabular-nums">
              {usage.used} / {usage.max}
            </span>
          </div>
        )}
      </section>

      <FormError message={error} />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Bağlı kaynaklar</h2>
        {connections.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-5 py-6 text-sm text-muted-foreground">
            <CircleDashedIcon className="size-4 shrink-0" aria-hidden />
            Henüz bağlı bir kaynak yok. Aşağıdan bir CRM seçin.
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {PROVIDER_LABEL[c.provider]}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium',
                      STATUS_TONE[c.status],
                    )}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Son senkron</dt>
                    <dd className="font-medium">
                      {c.lastSyncAt ? formatDateTime(c.lastSyncAt) : 'Henüz yok'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Bağlanma</dt>
                    <dd className="font-medium">{formatDateTime(c.createdAt)}</dd>
                  </div>
                </dl>
                {c.lastRun && <RunStatus run={c.lastRun} />}
                {c.lastCheck && !c.lastCheck.ok && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
                    Son kontrol başarısız: {c.lastCheck.message}
                  </p>
                )}
                {c.status === 'PENDING' && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Bağlantı doğrulanamadı. Bilgileri kontrol edip yeniden bağlanın.
                  </p>
                )}
                {canManage && (
                  <div className="flex justify-end gap-2">
                    {c.provider === 'LEADPILOT' && c.status === 'ACTIVE' && (
                      <Button variant="outline" size="sm" onClick={() => void syncNow(c)}>
                        <RefreshCwIcon aria-hidden />
                        Şimdi senkronize et
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setRemoving(c)}>
                      Kaldır
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void toggle(c)}>
                      {c.status === 'DISABLED' ? (
                        <PlayIcon aria-hidden />
                      ) : (
                        <PauseIcon aria-hidden />
                      )}
                      {c.status === 'DISABLED' ? 'Devam ettir' : 'Duraklat'}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Kaynak ekle</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {CATALOG.map((item) => (
            <article
              key={item.key}
              className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  {item.state === 'file' ? (
                    <FileSpreadsheetIcon className="size-5" aria-hidden />
                  ) : (
                    <PlugIcon className="size-5" aria-hidden />
                  )}
                </span>
                {item.badge && (
                  <span
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium',
                      item.badge === 'Önerilen' && 'bg-violet-100 text-violet-900',
                      item.badge === 'Hazır' && 'bg-emerald-100 text-emerald-900',
                      item.badge === 'Yakında' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="text-base font-semibold">{item.name}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <div className="flex justify-end">
                {item.state === 'connect' && (
                  <Button
                    onClick={() => setConnecting(true)}
                    disabled={!canManage || !data?.canConnect}
                    title={
                      !canManage
                        ? 'Bağlantı eklemek için yönetici yetkisi gerekir'
                        : !data?.canConnect
                          ? 'Paket bağlantı limitine ulaşıldı'
                          : undefined
                    }
                  >
                    <PlusIcon aria-hidden />
                    Bağla
                  </Button>
                )}
                {item.state === 'file' && (
                  <Link
                    href={`/w/${slug}/properties/import`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-accent"
                  >
                    <FileSpreadsheetIcon className="size-4" aria-hidden />
                    İçe aktar
                  </Link>
                )}
                {item.state === 'soon' && (
                  <Button variant="outline" disabled>
                    Yakında
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={removing !== null}
        title="Bağlantı kaldırılsın mı?"
        description="Bu bağlantı silinir. Mülk verileri kalır, ama bu kaynaktan yeni veri alınmaz ve lead’ler gönderilmez."
        confirmLabel="Evet, kaldır"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />

      {connecting && (
        <LeadPilotDialog
          tenantId={tenantId}
          onClose={() => setConnecting(false)}
          onDone={() => {
            setConnecting(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RunStatus({ run }: { run: NonNullable<IntegrationConnection['lastRun']> }) {
  if (run.status === 'RUNNING') {
    const pct = run.totalRows > 0 ? Math.round((run.processedRows / run.totalRows) * 100) : 0;
    return (
      <div
        className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Senkron çalışıyor</span>
          <span className="tabular-nums text-muted-foreground">
            {run.processedRows} / {run.totalRows} mülk · {run.photosAdded} fotoğraf
          </span>
        </div>
        <p className="text-muted-foreground">{run.stage ?? 'Hazırlanıyor'}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
  if (run.status === 'FAILED') {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
        Son senkron başarısız: {run.errorSummary ?? 'Bilinmeyen hata.'}
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Son senkron tamamlandı: {run.recordsCreated} yeni, {run.recordsUpdated} güncellenen mülk,{' '}
      {run.photosAdded} yeni fotoğraf
      {run.finishedAt ? ` · ${formatDateTime(run.finishedAt)}` : ''}
    </p>
  );
}
