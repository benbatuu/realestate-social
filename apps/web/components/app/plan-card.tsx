import type { CreditBalance, Currency, Entitlements } from '@app/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

function Meter({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const near = limit > 0 && pct >= 80;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {used}
          <span className="font-normal text-muted-foreground">
            {' '}
            / {limit}
            {unit ? ` ${unit}` : ''}
          </span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div
          className={cn('h-full rounded-full', near ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Plan limits and how much of each is used. Credits come from the balance when the caller has it.
 */
export function PlanCard({
  entitlements: e,
  credits,
}: {
  entitlements: Entitlements;
  credits?: CreditBalance;
}) {
  const price = formatPrice(e.priceMinor, e.currency as Currency | null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Paket
          {e.planName ? (
            <Badge variant="secondary">{e.planName}</Badge>
          ) : (
            <Badge variant="outline">Paket yok</Badge>
          )}
          {price && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">{price} / ay</span>
          )}
        </CardTitle>
        <CardDescription>
          {e.planName
            ? `Video geçmişi ${e.retentionDays} gün saklanır.`
            : 'Aktif paketiniz yok. Video üretmek için paket seçin.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <Meter label="Koltuk" used={e.usedSeats} limit={e.maxSeats} />
          {credits && (
            <>
              <Meter
                label="Kredi"
                used={credits.credits.monthly - credits.credits.available}
                limit={credits.credits.monthly}
              />
              <Meter
                label="Ücretsiz yeniden üretim"
                used={credits.freeRegenerations.granted - credits.freeRegenerations.available}
                limit={credits.freeRegenerations.granted}
              />
            </>
          )}
          <Meter label="CRM bağlantısı" used={e.usedCrmConnections} limit={e.maxCrmConnections} />
          <Meter label="Workspace" used={1} limit={e.maxWorkspaces} />
        </div>
      </CardContent>
    </Card>
  );
}
