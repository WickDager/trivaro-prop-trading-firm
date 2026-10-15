'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { adminButtonClass } from '@/components/admin/Actions';

export interface AdminColumn<T> {
  key: string;
  header: string;
  /** Cell renderer for the desktop table. */
  cell: (row: T) => ReactNode;
  /** Headline for the phone card. Falls back to `cell`. */
  primary?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** `tabular-nums` for numeric columns so digits line up. */
  numeric?: boolean;
  /** Omitted from the phone card (long ids, secondary metadata). */
  desktopOnly?: boolean;
  /** Column width hint, applied to `<th>`. */
  className?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * One table definition drives two layouts.
 *
 * A 7-column table inside a 320px viewport is unreadable, and `w-full` tables
 * never trigger an overflow wrapper — so phones get labelled cards and
 * >=sm gets the real table inside `overflow-x-auto`. Actions render in a
 * wrapping row on both, which is where the old overlapping buttons came from.
 */
export function AdminTable<T>({
  rows,
  columns,
  getRowKey,
  actions,
  loading,
  empty,
  rowTone,
  footer,
}: {
  rows: T[];
  columns: AdminColumn<T>[];
  getRowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  rowTone?: (row: T) => string | undefined;
  footer?: ReactNode;
}) {
  const bodyColumns = columns.filter((c) => !c.desktopOnly);
  const primaryColumn = bodyColumns[0] ?? columns[0];

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-busy="true">
        <span className="sr-only">Loading…</span>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <>{empty ?? <p className="py-8 text-center text-sm text-text-muted">Nothing to show.</p>}</>;
  }

  return (
    <div className="space-y-3">
      {/* ---- Phones: labelled cards ---- */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            className={cn('rounded-xl border border-amber-500/10 bg-navy-700/50 p-3', rowTone?.(row))}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">{primaryColumn.primary ? primaryColumn.primary(row) : primaryColumn.cell(row)}</div>
            </div>
            <dl className="mt-2 space-y-1">
              {bodyColumns.slice(1).map((column) => (
                <div key={column.key} className="flex items-baseline justify-between gap-3 text-xs">
                  <dt className="shrink-0 text-text-muted">{column.header}</dt>
                  <dd className={cn('min-w-0 text-right', column.numeric && 'tabular-nums')}>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {actions && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-amber-500/10 pt-3">
                {actions(row)}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ---- >=sm: real table ---- */}
      <div className="hidden overflow-x-auto rounded-xl border border-amber-500/10 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-500/10 bg-navy-800/60 text-text-muted">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide',
                    ALIGN[column.align ?? 'left'],
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn('border-b border-amber-500/5 last:border-0 hover:bg-navy-700/30', rowTone?.(row))}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-2.5 align-middle',
                      ALIGN[column.align ?? 'left'],
                      column.numeric && 'tabular-nums',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footer}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (next: number) => void;
}) {
  if (pageCount <= 1) {
    return (
      <p className="mt-3 text-right text-[11px] text-text-muted">
        {total} {total === 1 ? 'row' : 'rows'}
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-text-muted">
        Page {page + 1} of {pageCount} · {total} rows
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={adminButtonClass('secondary', 'sm')}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          type="button"
          className={adminButtonClass('secondary', 'sm')}
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
