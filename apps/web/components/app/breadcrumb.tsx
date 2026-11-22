'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LABELS: Record<string, string> = {
  properties: 'Portföy',
  import: 'İçe aktar',
  imports: 'İçe aktarma geçmişi',
  team: 'Ekip',
  leads: 'Leadler',
  videos: 'Videolar',
};

/** Path-based trail: workspace › section › page. Unknown IDs read as "Detay". */
export function Breadcrumb({ workspaceName, slug }: { workspaceName: string; slug: string }) {
  const pathname = usePathname();
  const base = `/w/${slug}`;
  const rest = pathname.startsWith(base)
    ? pathname.slice(base.length).split('/').filter(Boolean)
    : [];

  const crumbs: { label: string; href: string }[] = [{ label: workspaceName, href: base }];
  let href = base;
  for (const segment of rest) {
    href += `/${segment}`;
    const label = LABELS[segment] ?? (segment.length >= 32 ? 'Detay' : segment);
    crumbs.push({ label, href });
  }
  if (rest.length === 0) crumbs.push({ label: 'Genel bakış', href: base });

  return (
    <nav aria-label="Konum" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href + i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span className="text-muted-foreground" aria-hidden>
                  /
                </span>
              )}
              {last ? (
                <span aria-current="page" className="truncate font-medium">
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
