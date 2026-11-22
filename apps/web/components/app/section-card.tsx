import { cn } from '@/lib/utils';

/** A titled card used on account pages (profile, settings). */
export function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border bg-card', className)}>
      <header className="flex flex-col gap-1 border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="flex flex-1 flex-col px-5 py-5">{children}</div>
    </section>
  );
}
