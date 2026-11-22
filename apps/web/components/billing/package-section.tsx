'use client';

import type { PackageOption, SubscriptionView } from '@app/shared';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CreditCardIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiDelete, apiGet, apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<NonNullable<SubscriptionView['status']>, string> = {
  TRIALING: 'Deneme',
  ACTIVE: 'Aktif',
  PAST_DUE: 'Ödeme gecikti',
  CANCELED: 'İptal edildi',
  INCOMPLETE: 'Tamamlanmadı',
};

/** Packages, the current one, and pending changes. Owners change packages; others read. */
export function PackageSection({ tenantId, isOwner }: { tenantId: string; isOwner: boolean }) {
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<PackageOption | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiGet<SubscriptionView>('/subscriptions', { tenantId });
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    setError(null);
    setView(res.data);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmChange() {
    if (!target) return;
    setBusy(true);
    const res = await apiPost<SubscriptionView>(
      '/subscriptions/change',
      { planCode: target.plan.code },
      { tenantId },
    );
    setBusy(false);
    setTarget(null);
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    toast.success(
      target.relation === 'upgrade'
        ? 'Paketiniz yükseltildi.'
        : 'Düşürme dönem sonunda uygulanacak.',
    );
    setView(res.data);
  }

  async function cancelPending() {
    const res = await apiDelete('/subscriptions/change', { tenantId });
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      return;
    }
    toast.success('Bekleyen paket değişikliği iptal edildi.');
    void load();
  }

  if (!view)
    return error ? (
      <FormError message={error} />
    ) : (
      <p className="text-sm text-muted-foreground">Yükleniyor…</p>
    );

  const periodEnd = view.periodEnd ? formatDate(view.periodEnd) : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Paketler</h2>
          <p className="text-sm text-muted-foreground">
            {view.current
              ? `Şu an ${view.current.name} paketindesiniz${periodEnd ? `; dönem sonu ${periodEnd}` : ''}.`
              : 'Henüz bir paketiniz yok. Bir paket seçerek başlayın.'}
          </p>
        </div>
        {view.status && (
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium">
            {STATUS_LABEL[view.status]}
          </span>
        )}
      </div>

      {view.pending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {view.pending.plan.name} paketine {formatDate(view.pending.effectiveAt)} tarihinde
            geçilecek.
          </span>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => void cancelPending()}>
              Değişikliği iptal et
            </Button>
          )}
        </div>
      )}

      {error && <FormError message={error} />}

      <div className="grid gap-4 lg:grid-cols-4">
        {view.options.map((opt) => {
          const isCurrent = opt.relation === 'current';
          const price = formatPrice(opt.plan.monthlyPriceMinor, opt.plan.currency as 'TRY');
          const blocked = opt.blockers.length > 0;
          return (
            <article
              key={opt.plan.id}
              className={cn(
                'flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm',
                isCurrent && 'border-primary ring-1 ring-primary/30',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{opt.plan.name}</h3>
                {isCurrent && (
                  <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Mevcut
                  </span>
                )}
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {price}
                <span className="text-sm font-normal text-muted-foreground"> / ay</span>
              </p>
              <ul className="flex flex-col gap-2 text-sm">
                <Item>{opt.plan.monthlyCredits} kredi / ay</Item>
                <Item>{opt.plan.freeRegenerationAllowance} ücretsiz yeniden üretim</Item>
                <Item>{opt.plan.maxSeats} kullanıcı</Item>
                <Item>{opt.plan.maxCrmConnections} CRM bağlantısı</Item>
                <Item>{opt.plan.retentionDays} gün video saklama</Item>
              </ul>

              <div className="mt-auto flex flex-col gap-2">
                {isCurrent ? (
                  <Button variant="outline" disabled>
                    Mevcut paket
                  </Button>
                ) : (
                  <Button
                    variant={opt.relation === 'upgrade' ? 'default' : 'outline'}
                    disabled={!isOwner || blocked || busy}
                    onClick={() => setTarget(opt)}
                  >
                    {opt.relation === 'upgrade' ? (
                      <ArrowUpIcon aria-hidden />
                    ) : (
                      <ArrowDownIcon aria-hidden />
                    )}
                    {opt.relation === 'upgrade' ? 'Yükselt' : 'Düşür'}
                  </Button>
                )}
                {blocked && <p className="text-xs text-red-700">{opt.blockers.join(' ')}</p>}
                {!isOwner && !isCurrent && (
                  <p className="text-xs text-muted-foreground">Paket değişikliğini sahip yapar.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/30 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CreditCardIcon className="size-4" aria-hidden />
          Ödeme yöntemi
        </div>
        <p className="text-sm text-muted-foreground">
          Henüz bir ödeme yöntemi eklenmedi. Yükseltmelerdeki fark ve yenilemeler, ödeme yöntemi
          bağlandığında çekilecek.
        </p>
        <Button variant="outline" className="w-fit" disabled>
          Ödeme yöntemi ekle (yakında)
        </Button>
      </div>

      <ConfirmDialog
        open={target !== null}
        title={
          target?.relation === 'upgrade'
            ? `${target.plan.name} paketine yükseltilsin mi?`
            : `${target?.plan.name} paketine düşülsün mü?`
        }
        description={
          target?.relation === 'upgrade'
            ? 'Paket hemen değişir ve yeni limitler şimdi geçerli olur. Ödeme yöntemi bağlanınca fark ücretlendirilecek.'
            : `Düşüş dönem sonunda (${view.periodEnd ? formatDate(view.periodEnd) : '—'}) uygulanır. Bu tarihe kadar mevcut paketiniz geçerli kalır.`
        }
        confirmLabel={target?.relation === 'upgrade' ? 'Yükselt' : 'Düşürmeyi onayla'}
        destructive={target?.relation === 'downgrade'}
        busy={busy}
        onConfirm={() => void confirmChange()}
        onCancel={() => setTarget(null)}
      />
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <CheckIcon className="size-4 shrink-0 text-emerald-600" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
