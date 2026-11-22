import type { Coverage } from '@app/shared';
import { cn } from '@/lib/utils';

const STYLES: Record<Coverage['level'], string> = {
  low: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300',
  high: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300',
};

export function coverageLevel(score: number): Coverage['level'] {
  return score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
}

/** Score with a text label; colour is never the only signal. */
export function CoverageBadge({ score, className }: { score: number; className?: string }) {
  const level = coverageLevel(score);
  const label = level === 'high' ? 'İyi' : level === 'medium' ? 'Orta' : 'Düşük';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset',
        STYLES[level],
        className,
      )}
      title={`Veri doluluğu: ${score}/100`}
    >
      {score}
      <span className="font-normal">· {label}</span>
    </span>
  );
}
