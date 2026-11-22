'use client';

import {
  type Currency,
  IMPORT_FIELDS,
  type ImportFieldKey,
  type ImportMapping,
  type ImportPreview,
  type ImportSummary,
  type ImportUploadResponse,
} from '@app/shared';
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FormError } from '@/components/auth/form-error';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { apiDownload, apiGet, apiPost, apiUpload } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { LISTING_TYPE_LABELS } from '@/lib/format';

type Step =
  | { kind: 'upload' }
  | { kind: 'mapping'; upload: ImportUploadResponse; mapping: ImportMapping }
  | {
      kind: 'preview';
      upload: ImportUploadResponse;
      mapping: ImportMapping;
      preview: ImportPreview;
    }
  | { kind: 'running'; summary: ImportSummary };

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive';

const FIELD_LABEL = new Map<string, string>(IMPORT_FIELDS.map((f) => [f.key, f.label]));
const STEPS = ['Dosya', 'Eşleme', 'Önizleme', 'Sonuç'];

function Stepper({ index }: { index: number }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Adımlar">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === index ? 'step' : undefined}
          className={i === index ? 'font-medium' : 'text-muted-foreground'}
        >
          <span className="mr-1.5 tabular-nums">{i + 1}.</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function ImportWizard({ tenantId, slug }: { tenantId: string; slug: string }) {
  const [step, setStep] = useState<Step>({ kind: 'upload' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const opts = { tenantId };

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    const res = await apiUpload<ImportUploadResponse>('/imports', form, opts);
    setBusy(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setStep({ kind: 'mapping', upload: res.data, mapping: res.data.suggestedMapping });
  }

  async function preview(upload: ImportUploadResponse, mapping: ImportMapping) {
    setBusy(true);
    setError(null);
    setIssues([]);
    const res = await apiPost<ImportPreview>(
      `/imports/${upload.import.id}/preview`,
      { mapping },
      opts,
    );
    setBusy(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      setIssues(res.error.issues ?? []);
      return;
    }
    setStep({ kind: 'preview', upload, mapping, preview: res.data });
  }

  async function commit(upload: ImportUploadResponse, mapping: ImportMapping) {
    setBusy(true);
    setError(null);
    const res = await apiPost<ImportSummary>(
      `/imports/${upload.import.id}/commit`,
      { mapping },
      opts,
    );
    setBusy(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setStep({ kind: 'running', summary: res.data });
  }

  // Poll the import while the worker runs it.
  const runningId = step.kind === 'running' ? step.summary.id : null;
  const runningStatus = step.kind === 'running' ? step.summary.status : null;
  useEffect(() => {
    if (!runningId || (runningStatus !== 'QUEUED' && runningStatus !== 'RUNNING')) return;
    const timer = setTimeout(async () => {
      const res = await apiGet<ImportSummary>(`/imports/${runningId}`, { tenantId });
      if (res.ok) setStep({ kind: 'running', summary: res.data });
    }, 1000);
    return () => clearTimeout(timer);
  }, [runningId, runningStatus, step, tenantId]);

  if (step.kind === 'upload') {
    return (
      <div className="flex flex-col gap-6">
        <Stepper index={0} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portföy dosyasını yükleyin</CardTitle>
            <CardDescription>
              CRM’den ya da Excel’den aldığınız listeyi CSV veya XLSX olarak yükleyin. İlk satır
              sütun başlıkları olmalı. Her mülk için bir ilan/portföy numarası gerekir; aynı dosyayı
              tekrar yüklediğinizde mülkler çoğalmaz, güncellenir.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormError message={error} />
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
              <FileSpreadsheetIcon className="size-6 text-muted-foreground" aria-hidden />
              <Button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
                {busy ? 'Dosya okunuyor…' : 'Dosya seç'}
              </Button>
              <p className="text-xs text-muted-foreground">
                .csv ya da .xlsx · en fazla 10 MB ve 5.000 satır
              </p>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                aria-label="Portföy dosyası"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dosyadaki eşlemediğiniz sütunlar (ör. mülk sahibi telefonu) okunmaz ve saklanmaz.
              Yüklenen dosya içe aktarma bitince ya da 24 saat içinde silinir.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step.kind === 'mapping') {
    const { upload, mapping } = step;
    const setColumn = (key: ImportFieldKey, column: string) => {
      const columns = { ...mapping.columns };
      if (column) columns[key] = column;
      else delete columns[key];
      setStep({ ...step, mapping: { ...mapping, columns } });
    };
    const issueFor = (key: string) => issues.find((i) => i.path === key)?.message;
    const priceMapped = Boolean(mapping.columns.price);

    return (
      <div className="flex flex-col gap-6">
        <Stepper index={1} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sütunları eşleyin</CardTitle>
            <CardDescription>
              {upload.import.fileName} · {upload.import.totalRows} satır
              {upload.detected.encoding ? ` · ${upload.detected.encoding}` : ''}
              {upload.detected.delimiter
                ? ` · ayraç “${upload.detected.delimiter === '\t' ? 'sekme' : upload.detected.delimiter}”`
                : ''}
              . Önerileri kontrol edin; eşlemediğiniz alanlar mevcut kayıtlarda değiştirilmez.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FormError message={error} />
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
              {IMPORT_FIELDS.map((field) => {
                const issue = issueFor(field.key);
                const id = `map-${field.key}`;
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label htmlFor={id} className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </label>
                    <select
                      id={id}
                      className={selectClass}
                      value={mapping.columns[field.key] ?? ''}
                      aria-invalid={Boolean(issue)}
                      onChange={(e) => setColumn(field.key, e.target.value)}
                    >
                      <option value="">— Eşleme yok —</option>
                      {upload.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                          {c.example ? ` (ör. ${c.example})` : ''}
                        </option>
                      ))}
                    </select>
                    {issue && <p className="text-xs text-destructive">{issue}</p>}
                  </div>
                );
              })}
            </div>
            <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Sayı ve para biçimi</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(
                  [
                    ['tr', 'Türkçe (4.500.000,50)'],
                    ['en', 'İngilizce (4,500,000.50)'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="numberFormat"
                      value={value}
                      checked={mapping.numberFormat === value}
                      onChange={() =>
                        setStep({ ...step, mapping: { ...mapping, numberFormat: value } })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {priceMapped && (
                <div className="flex flex-col gap-1.5 sm:w-72">
                  <label htmlFor="defaultCurrency" className="text-sm font-medium">
                    Para birimi belirtilmemiş fiyatlar için
                  </label>
                  <select
                    id="defaultCurrency"
                    className={selectClass}
                    value={mapping.defaultCurrency ?? ''}
                    onChange={(e) =>
                      setStep({
                        ...step,
                        mapping: {
                          ...mapping,
                          defaultCurrency: (e.target.value || null) as Currency | null,
                        },
                      })
                    }
                  >
                    <option value="">Seçilmedi (bu satırlar hata verir)</option>
                    <option value="TRY">Türk lirası (TL)</option>
                    <option value="USD">ABD doları</option>
                    <option value="EUR">Euro</option>
                    <option value="GBP">İngiliz sterlini</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    “4.500.000 TL” gibi para birimi yazılı fiyatlar bu seçimden etkilenmez.
                  </p>
                </div>
              )}
            </fieldset>
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep({ kind: 'upload' })} disabled={busy}>
              Başka dosya
            </Button>
            <Button onClick={() => preview(upload, mapping)} disabled={busy}>
              {busy ? 'Kontrol ediliyor…' : 'Önizle'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (step.kind === 'preview') {
    const { upload, mapping, preview: p } = step;
    const stats: [string, number][] = [
      ['Yeni', p.create],
      ['Güncellenecek', p.update],
      ['Değişmeyecek', p.unchanged],
      ['Hatalı', p.failed],
    ];
    return (
      <div className="flex flex-col gap-6">
        <Stepper index={2} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Önizleme</CardTitle>
            <CardDescription>
              {p.totalRows} satırın {p.valid} tanesi içe aktarılabilir. Hatalı satırlar atlanır;
              geri kalanlar etkilenmez.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FormError message={error} />
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {p.sample.length > 0 && (
              <section className="flex flex-col gap-2" aria-labelledby="sample-h">
                <h3 id="sample-h" className="text-sm font-medium">
                  İlk satırlar
                </h3>
                <DataTable
                  label="Örnek satırlar"
                  rows={p.sample}
                  rowKey={(s) => String(s.rowNumber)}
                  columns={[
                    {
                      id: 'externalId',
                      header: 'İlan no',
                      cell: (s) => <span className="tabular-nums">{s.externalId}</span>,
                    },
                    {
                      id: 'title',
                      header: 'Başlık',
                      cell: (s) => (
                        <div className="flex flex-col">
                          <span className="line-clamp-1">{s.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {LISTING_TYPE_LABELS[s.listingType]}
                            {s.location ? ` · ${s.location}` : ''}
                          </span>
                        </div>
                      ),
                    },
                    {
                      id: 'price',
                      header: 'Fiyat',
                      hideBelow: 'sm',
                      cell: (s) => <span className="tabular-nums">{s.price ?? '—'}</span>,
                    },
                    {
                      id: 'action',
                      header: 'İşlem',
                      cell: (s) => (
                        <Badge variant={s.action === 'unchanged' ? 'outline' : 'secondary'}>
                          {s.action === 'create'
                            ? 'Yeni'
                            : s.action === 'update'
                              ? 'Güncelleme'
                              : 'Değişmez'}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </section>
            )}
            {p.errors.length > 0 && (
              <section className="flex flex-col gap-2" aria-labelledby="errors-h">
                <h3 id="errors-h" className="flex items-center gap-1.5 text-sm font-medium">
                  <TriangleAlertIcon className="size-4 text-amber-600" aria-hidden />
                  Hatalı satırlar{p.failed > p.errors.length ? ` (ilk ${p.errors.length})` : ''}
                </h3>
                <DataTable
                  label="Hatalı satırlar"
                  rows={p.errors}
                  rowKey={(e) => `${e.rowNumber}-${e.field}-${e.message}`}
                  columns={[
                    {
                      id: 'row',
                      header: 'Satır',
                      width: '5rem',
                      cell: (e) => <span className="tabular-nums">{e.rowNumber}</span>,
                    },
                    {
                      id: 'field',
                      header: 'Alan',
                      width: '12rem',
                      cell: (e) => (e.field ? (FIELD_LABEL.get(e.field) ?? e.field) : '—'),
                    },
                    { id: 'message', header: 'Sorun', cell: (e) => e.message },
                  ]}
                />
              </section>
            )}
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setStep({ kind: 'mapping', upload, mapping })}
              disabled={busy}
            >
              Eşlemeyi değiştir
            </Button>
            <Button onClick={() => commit(upload, mapping)} disabled={busy || p.valid === 0}>
              {busy ? 'Başlatılıyor…' : `${p.valid} kaydı içe aktar`}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const s = step.summary;
  const running = s.status === 'QUEUED' || s.status === 'RUNNING';
  const pct = s.totalRows ? Math.round((s.processedRows / s.totalRows) * 100) : 0;
  return (
    <div className="flex flex-col gap-6">
      <Stepper index={3} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {s.status === 'COMPLETED' && (
              <CheckCircle2Icon className="size-5 text-emerald-600" aria-hidden />
            )}
            {running
              ? 'İçe aktarılıyor…'
              : s.status === 'COMPLETED'
                ? 'İçe aktarma tamamlandı'
                : 'İçe aktarma başarısız'}
          </CardTitle>
          <CardDescription>{s.fileName}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {running && (
            <div className="flex flex-col gap-2" role="status">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">
                {s.processedRows} / {s.totalRows} satır
              </p>
            </div>
          )}
          {s.status === 'COMPLETED' && (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(
                [
                  ['Yeni', s.created],
                  ['Güncellenen', s.updated],
                  ['Değişmeyen', s.unchanged],
                  ['Hatalı', s.failed],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {s.status === 'FAILED' && (
            <FormError message="İçe aktarma tamamlanamadı. Yazılan kayıtlar korunur; dosyayı yeniden yükleyip tekrar deneyin." />
          )}
        </CardContent>
        {!running && (
          <CardFooter className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setStep({ kind: 'upload' })}>
              Yeni dosya yükle
            </Button>
            <div className="flex flex-wrap gap-2">
              {s.failed > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void apiDownload(
                      `/imports/${s.id}/errors.csv`,
                      `ice-aktarma-hatalari-${s.id.slice(0, 8)}.csv`,
                      opts,
                    )
                  }
                >
                  <DownloadIcon aria-hidden />
                  Hata raporu
                </Button>
              )}
              <Link href={`/w/${slug}/properties`} className={buttonVariants()}>
                Portföye git
              </Link>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
