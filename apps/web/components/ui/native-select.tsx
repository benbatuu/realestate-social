import { ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Native select with a visible chevron and room for it on the right. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative inline-flex">
      <select
        {...props}
        className={cn(
          'h-8 appearance-none rounded-lg border border-input bg-transparent py-1 pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          className,
        )}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
