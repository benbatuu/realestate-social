import type { Coverage } from '@app/shared';
import { CheckIcon, CircleDashedIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The score always comes with its breakdown (blueprint §6.3). Missing items first. */
export function CoverageCard({ coverage }: { coverage: Coverage }) {
  const missing = coverage.items.filter((i) => i.earned < i.weight);
  const barColor =
    coverage.score >= 75 ? 'bg-emerald-500' : coverage.score >= 45 ? 'bg-amber-500' : 'bg-red-500';
  const items = [...coverage.items].sort(
    (a, b) => Number(a.earned >= a.weight) - Number(b.earned >= b.weight),
  );

  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Veri doluluğu</h2>
            <p className="text-xs text-muted-foreground">
              Video ve analiz için bilgilerin eksiksizliği.
            </p>
          </div>
          <p className="text-3xl leading-none font-semibold tabular-nums">
            {coverage.score}
            <span className="text-base text-muted-foreground">/100</span>
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={coverage.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Veri doluluğu"
        >
          <div
            className={cn('h-full rounded-full transition-[width]', barColor)}
            style={{ width: `${coverage.score}%` }}
          />
        </div>
      </div>

      <ul className="flex flex-col divide-y text-sm">
        {items.map((item) => {
          const complete = item.earned >= item.weight;
          return (
            <li key={item.key} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
              {complete ? (
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Tamam" />
              ) : (
                <CircleDashedIcon
                  className="mt-0.5 size-4 shrink-0 text-amber-600"
                  aria-label="Eksik"
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center justify-between gap-2">
                  <span className={complete ? '' : 'font-medium'}>{item.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.earned}/{item.weight}
                  </span>
                </span>
                {item.hint && !complete && (
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {missing.length === 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Bu mülkün bilgileri eksiksiz.
        </p>
      )}
    </section>
  );
}
