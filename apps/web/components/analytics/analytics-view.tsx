'use client';

import type {
  AnalyticsLatest,
  AnalyticsProperty,
  AnalyticsResponse,
  AnalyticsSnapshotStatus,
} from '@app/shared';
import { DataTable } from '@/components/ui/data-table';
import {
  AlertTriangleIcon,
  BarChart3Icon,
  ChevronRightIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FormError } from '@/components/auth/form-error';
import { apiGet, apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const PERIODS = [
  { days: 30, label: '30 gün' },
  { days: 90, label: '90 gün' },
  { days: 365, label: '1 yıl' },
] as const;

interface Insight {
  key: string;
  title: string;
  why: (p: AnalyticsProperty) => string;
  match: (p: AnalyticsProperty) => boolean;
}

/** Each rule says what it looks at, so the reason can be shown next to every property. */
const INSIGHTS: Insight[] = [
  {
    key: 'no-leads',
    title: 'Uzun süredir lead almayan mülkler',
    match: (p) => p.leadsTotal === 0 && p.ageDays >= 30,
    why: (p) => `${p.ageDays} gündür portföyde, hiç lead yok`,
  },
  {
    key: 'low-conversion',
    title: 'Lead var ama kazanım yok',
    match: (p) => p.leadsLost >= 2 && p.leadsWon === 0,
    why: (p) => `${p.leadsLost} lead kaybedildi, hiç kazanılmadı`,
  },
  {
    key: 'ready-video',
    title: 'Video için hazır, henüz videosu yok',
    match: (p) => p.photoCount >= 5 && p.videoCount === 0,
    why: (p) => `${p.photoCount} fotoğraf var, henüz video üretilmedi`,
  },
  {
    key: 'few-photos',
    title: 'Fotoğrafı az mülkler',
    match: (p) => p.photoCount < 5,
    why: (p) => `Sadece ${p.photoCount} fotoğraf var; en az 5 önerilir`,
  },
  {
    key: 'no-description',
    title: 'Açıklaması olmayan mülkler',
    match: (p) => !p.hasDescription,
    why: () => 'Açıklama boş; ilan ve video metni için gerekli',
  },
  {
    key: 'low-coverage',
    title: 'Veri doluluğu düşük mülkler',
    match: (p) => p.coverageScore < 60,
    why: (p) => `Veri doluluğu %${p.coverageScore}; eksik bilgileri tamamlayın`,
  },
];

export function AnalyticsView({
  tenantId,
  slug,
  canRun,
}: {
  tenantId: string;
  slug: string;
  /** Viewers read the report; only members and above run a new analysis. */
  canRun: boolean;
}) {
  const [days, setDays] = useState<number>(30);
  const [latest, setLatest] = useState<AnalyticsLatest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState('25');

  const data: AnalyticsResponse | null = latest?.data ?? null;
  const run: AnalyticsSnapshotStatus | null = latest?.run ?? null;
  const running = run?.status === 'RUNNING';

  const load = useCallback(async () => {
    const res = await apiGet<AnalyticsLatest>(`/analytics/properties?days=${days}`, { tenantId });
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setError(null);
    setLatest(res.data);
  }, [days, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While a run is in progress, look again every two seconds. Leaving the page is fine: the
  // run continues in the background and the result is there next time.
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => void load(), 2000);
    return () => clearTimeout(t);
  }, [running, load, latest]);

  async function startRun() {
    setStarting(true);
    const res = await apiPost<AnalyticsSnapshotStatus>('/analytics/runs', { days }, { tenantId });
    setStarting(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    void load();
  }

  const rows = data?.properties ?? [];
  const sorted = [...rows].sort(
    (a, b) => b.leadsInPeriod - a.leadsInPeriod || b.leadsTotal - a.leadsTotal,
  );
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  const filteredRows = sorted.filter((p) => {
    if (needle && !p.title.toLocaleLowerCase('tr-TR').includes(needle)) return false;
    if (filter === 'nophoto') return p.photoCount === 0;
    if (filter === 'novideo') return p.videoCount === 0;
    if (filter === 'nolead') return p.leadsInPeriod === 0;
    if (filter === 'lowcov') return p.coverageScore < 60;
    return true;
  });
  const tableSize = Number(tablePageSize);
  const tablePages = Math.max(1, Math.ceil(filteredRows.length / tableSize));
  const currentPage = Math.min(tablePage, tablePages);
  const pageRows =
    tablePageSize === '1000'
      ? filteredRows
      : filteredRows.slice((currentPage - 1) * tableSize, currentPage * tableSize);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Analiz</h1>
          <p className="text-sm text-muted-foreground">
            Portföyünüzde neyin çalıştığını, neyin takip edilmesi gerektiğini gösterir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Dönem">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                aria-pressed={days === p.days}
                onClick={() => setDays(p.days)}
                className={cn(
                  'h-7 rounded-md px-3 text-sm transition-colors',
                  days === p.days
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {canRun && (
            <Button onClick={() => void startRun()} disabled={starting || running}>
              <RefreshCwIcon className={cn(running && 'animate-spin')} aria-hidden />
              {running ? 'Hesaplanıyor…' : 'Şimdi hesapla'}
            </Button>
          )}
        </div>
      </section>

      <FormError message={error} />

      {running && (
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm" role="status">
          Analiz arka planda hesaplanıyor. Bu sayfadan çıkabilirsiniz; sonuç hazır olduğunda burada
          görünür.
        </p>
      )}
      {run?.status === 'FAILED' && <FormError message={run.error ?? 'Analiz hesaplanamadı.'} />}
      {latest?.computedAt && (
        <p className="text-xs text-muted-foreground">
          Son hesaplama: {formatDateTime(latest.computedAt)}
        </p>
      )}

      {!data && !running && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center">
          <p className="font-medium">Henüz analiz yapılmadı</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Hesapla'ya basın; sonuç arka planda hazırlanır ve hazır olduğunda burada görünür. Her
            gece tüm portföyler için otomatik hesaplanır.
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Mülk" value={data.summary.properties} />
            <Kpi label={`Lead (son ${data.days} gün)`} value={data.summary.leadsInPeriod} />
            <Kpi
              label="Kazanılan"
              value={data.summary.leadsWon}
              hint={`${data.summary.leadsLost} kaybedilen`}
            />
            <Kpi
              label="Videosu olan mülk"
              value={data.summary.propertiesWithVideo}
              hint={`${data.summary.propertiesWithoutLeads} mülkte hiç lead yok`}
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Dikkat gerektirenler</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {INSIGHTS.map((ins) => {
                const hits = rows.filter(ins.match);
                return (
                  <article
                    key={ins.key}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangleIcon className="size-4 text-muted-foreground" aria-hidden />
                        {ins.title}
                      </h3>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">
                        {hits.length}
                      </span>
                    </div>
                    {hits.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Bu konuda sorun yok.</p>
                    ) : (
                      <ul className="flex flex-col divide-y">
                        {hits.slice(0, 5).map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/w/${slug}/properties/${p.id}`}
                              className="group flex items-center justify-between gap-3 py-2.5"
                            >
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium group-hover:underline">
                                  {p.title}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {ins.why(p)}
                                </span>
                              </span>
                              <ChevronRightIcon
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {hits.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{hits.length - 5} mülk daha</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Mülkler</h2>
            <DataTable
              label="Mülkler analizi"
              rows={pageRows}
              rowKey={(p) => p.id}
              toolbar={
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
                  <div className="relative min-w-56 flex-1">
                    <SearchIcon
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      aria-label="Mülk ara"
                      placeholder="Mülk adına göre ara"
                      className="pl-8"
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setTablePage(1);
                      }}
                    />
                  </div>
                  <NativeSelect
                    aria-label="Filtre"
                    className="w-56"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setTablePage(1);
                    }}
                  >
                    <option value="">Tüm mülkler</option>
                    <option value="nophoto">Fotoğrafı yok</option>
                    <option value="novideo">Videosu yok</option>
                    <option value="nolead">Lead almamış</option>
                    <option value="lowcov">Veri doluluğu %60 altında</option>
                  </NativeSelect>
                </div>
              }
              pagination={{
                page: currentPage,
                pageSize: tablePageSize,
                total: filteredRows.length,
                pageSizes: ['10', '25', '50', '100', '1000'],
                defaultPageSize: '25',
                unit: 'mülk',
                onPageChange: setTablePage,
                onPageSizeChange: (size) => {
                  setTablePageSize(size);
                  setTablePage(1);
                },
              }}
              columns={[
                {
                  id: 'title',
                  header: 'Mülk',
                  cell: (p) => (
                    <Link
                      href={`/w/${slug}/properties/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                  ),
                },
                {
                  id: 'age',
                  header: 'Yaş',
                  align: 'right',
                  cell: (p) => <span className="tabular-nums">{p.ageDays} gün</span>,
                },
                {
                  id: 'photos',
                  header: 'Foto',
                  align: 'right',
                  cell: (p) => <span className="tabular-nums">{p.photoCount}</span>,
                },
                {
                  id: 'videos',
                  header: 'Video',
                  align: 'right',
                  cell: (p) => <span className="tabular-nums">{p.videoCount}</span>,
                },
                {
                  id: 'leads',
                  header: 'Lead',
                  align: 'right',
                  cell: (p) => <span className="tabular-nums">{p.leadsInPeriod}</span>,
                },
                {
                  id: 'won',
                  header: 'Kazanılan',
                  align: 'right',
                  cell: (p) => <span className="tabular-nums">{p.leadsWon}</span>,
                },
                {
                  id: 'coverage',
                  header: 'Doluluk',
                  align: 'right',
                  cell: (p) => <span className="tabular-nums">%{p.coverageScore}</span>,
                },
              ]}
            />
          </section>

          <section className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            <BarChart3Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Bu analizde lead, video, fotoğraf ve veri doluluğu kullanılıyor. Portal görüntülenme
              ve tıklama verisi henüz bağlı değil; bu yüzden dönüşüm oranı gösterilmiyor. Fiyat
              geçmişi de henüz kaydedilmediği için fiyat değişimi analizde yok.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
