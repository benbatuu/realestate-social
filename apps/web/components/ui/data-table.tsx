import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageSizeSelect } from '@/components/ui/page-size-select';
import { cn } from '@/lib/utils';

/** One column. `cell` gets a row and returns what to show. */
export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Column width, e.g. `minmax(0,2.4fr)` or `10rem`. */
  width?: string;
  align?: 'left' | 'right';
  /** Column hidden below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

/** Paging state comes from the page: it lives in the URL, so links and reloads keep it. */
export interface DataPagination {
  page: number;
  pageSize: string;
  total: number;
  /** Shown as the page size choice. Leave out to hide the choice. */
  pageSizes?: readonly string[];
  defaultPageSize?: string;
  /** Name of one row, for the summary: "25 mülk". */
  unit?: string;
  /** URL mode: each page is a link. */
  pageHref?: (page: number, pageSize: string) => string;
  /** State mode: the page is changed by callback instead of a link. */
  onPageChange?: (page: number) => void;
  /** State mode: the page size is changed by callback instead of the URL. */
  onPageSizeChange?: (size: string) => void;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Search and filters of the page, shown above the table. */
  toolbar?: ReactNode;
  pagination?: DataPagination;
  /** Shown instead of the table when there are no rows. */
  empty?: ReactNode;
  label: string;
}

const HIDE: Record<NonNullable<DataColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

/**
 * The one table of the app. Look and paging come from here; each page passes its
 * columns, rows, toolbar (search and filters) and paging state.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  toolbar,
  pagination,
  empty,
  label,
}: DataTableProps<T>) {
  const pg: DataPagination = pagination ?? {
    page: 1,
    pageSize: '1000',
    total: rows.length,
  };
  const pages = pagination ? Math.max(1, Math.ceil(pg.total / Number(pg.pageSize))) : 1;
  const showAll = pg.pageSize === '1000';
  const unit = pg.unit ?? 'kayıt';

  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      {rows.length === 0 ? (
        (empty ?? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Kayıt yok.
          </p>
        ))
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={label}>
              <thead className="bg-muted/50">
                <tr className="border-b">
                  {columns.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      style={c.width ? { width: c.width } : undefined}
                      className={cn(
                        'px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase',
                        c.align === 'right' ? 'text-right' : 'text-left',
                        c.hideBelow && HIDE[c.hideBelow],
                      )}
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={rowKey(r)} className="transition-colors hover:bg-muted/40">
                    {columns.map((c) => (
                      <td
                        key={c.id}
                        className={cn(
                          'px-5 py-4 align-middle',
                          c.align === 'right' && 'text-right',
                          c.hideBelow && HIDE[c.hideBelow],
                        )}
                      >
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 text-sm"
            aria-label="Sayfalar"
          >
            <div className="flex flex-wrap items-center gap-4">
              {pagination?.pageSizes && (
                <PageSizeSelect
                  value={pg.pageSize}
                  options={pagination.pageSizes}
                  defaultValue={pg.defaultPageSize ?? pagination.pageSizes[0] ?? '25'}
                  onChange={pagination.onPageSizeChange}
                />
              )}
              <span className="text-muted-foreground">
                {!pagination
                  ? `${rows.length} ${unit}`
                  : showAll
                    ? `${pg.total} ${unit}`
                    : `Sayfa ${pg.page} / ${pages} · toplam ${pg.total} ${unit}`}
              </span>
            </div>
            {pagination && pages > 1 && !showAll && (
              <div className="flex gap-2">
                {pg.onPageChange ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pg.page <= 1}
                      onClick={() => pg.onPageChange?.(pg.page - 1)}
                    >
                      <ChevronLeftIcon aria-hidden />
                      Önceki
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pg.page >= pages}
                      onClick={() => pg.onPageChange?.(pg.page + 1)}
                    >
                      Sonraki
                      <ChevronRightIcon aria-hidden />
                    </Button>
                  </>
                ) : (
                  <>
                    <Link
                      href={pg.pageHref?.(pg.page - 1, pg.pageSize) ?? '#'}
                      aria-disabled={pg.page <= 1}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        pg.page <= 1 && 'pointer-events-none opacity-50',
                      )}
                    >
                      <ChevronLeftIcon aria-hidden />
                      Önceki
                    </Link>
                    <Link
                      href={pg.pageHref?.(pg.page + 1, pg.pageSize) ?? '#'}
                      aria-disabled={pg.page >= pages}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        pg.page >= pages && 'pointer-events-none opacity-50',
                      )}
                    >
                      Sonraki
                      <ChevronRightIcon aria-hidden />
                    </Link>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
