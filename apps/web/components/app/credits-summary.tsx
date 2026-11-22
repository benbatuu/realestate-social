import type { CreditBalance } from '@app/shared';

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {value}
          <span className="font-normal text-muted-foreground"> / {total}</span>
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Sidebar footer: what is left this period. Shows a plain note when there is no plan. */
export function CreditsSummary({ credits }: { credits: CreditBalance }) {
  if (!credits.planCode) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
        Aktif paket yok. Video üretmek için paket seçin.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card px-3 py-3">
      <Meter label="Kredi" value={credits.credits.available} total={credits.credits.monthly} />
      <Meter
        label="Ücretsiz üretim"
        value={credits.freeRegenerations.available}
        total={credits.freeRegenerations.granted}
      />
    </div>
  );
}
