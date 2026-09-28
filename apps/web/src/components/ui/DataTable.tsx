import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { EmptyState } from './EmptyState';
import { LoadingBlock } from './Spinner';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  initialSortKey?: string;
  initialSortDir?: 'asc' | 'desc';
  dense?: boolean;
  renderExpanded?: (row: T) => ReactNode;
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading,
  searchable = true,
  searchPlaceholder = 'Tìm kiếm...',
  pageSize = 10,
  toolbar,
  emptyTitle,
  emptyMessage,
  initialSortKey,
  initialSortDir = 'asc',
  dense,
  renderExpanded,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);
  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(new Set());

  const toggleExpanded = (key: string | number) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const valueOf = (row: T, col: Column<T>, sort: boolean): string | number => {
    if (sort && col.sortValue) return col.sortValue(row);
    const raw = (row as Record<string, unknown>)[col.key];
    return raw == null ? '' : (raw as string | number);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((col) => {
        const hay = col.searchValue ? col.searchValue(row) : String(valueOf(row, col, false) ?? '');
        return hay.toLowerCase().includes(q);
      })
    );
  }, [data, columns, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = valueOf(a, col, true);
      const bv = valueOf(b, col, true);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv), 'vi');
    });
    if (sortDir === 'desc') copy.reverse();
    return copy;
  }, [filtered, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable && !col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {searchable ? (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : sorted.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {renderExpanded && <th className="w-10 px-3 py-3" />}
                {columns.map((col) => {
                  const canSort = col.sortable || !!col.sortValue;
                  return (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col)}
                      className={cn(
                        'px-4 py-3',
                        ALIGN[col.align ?? 'left'],
                        canSort && 'cursor-pointer select-none hover:text-slate-700',
                        col.className
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {sortKey === col.key && <span className="text-brand-cyan">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((row) => {
                const key = rowKey(row);
                const expanded = !!renderExpanded && expandedKeys.has(key);
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={renderExpanded ? () => toggleExpanded(key) : onRowClick ? () => onRowClick(row) : undefined}
                      className={cn('bg-white transition', (renderExpanded || onRowClick) && 'cursor-pointer hover:bg-brand-cyan-subtle')}
                    >
                      {renderExpanded && (
                        <td className="w-10 px-3 py-3">
                          <ChevronRight className={cn('h-4 w-4 text-slate-400 transition-transform', expanded && 'rotate-90 text-brand-cyan')} />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className={cn(dense ? 'px-4 py-2' : 'px-4 py-3', ALIGN[col.align ?? 'left'], col.className)}>
                          {col.render ? col.render(row) : String(valueOf(row, col, false) ?? '')}
                        </td>
                      ))}
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={columns.length + 1} className="px-4 py-3">
                          {renderExpanded?.(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>
            {sorted.length} bản ghi · trang {safePage}/{totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
