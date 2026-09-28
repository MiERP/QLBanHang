import type { ReactNode } from 'react';

export interface SubColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T) => ReactNode;
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

// Bảng con hiển thị trong dòng xổ ra của các báo cáo (doanh thu, phí vận chuyển...).
export function SubTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyText = 'Không có đơn hàng nào.',
}: {
  columns: SubColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}) {
  if (!rows.length) return <div className="py-2 text-sm text-slate-400">{emptyText}</div>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className={`py-2 pr-4 ${ALIGN[col.align ?? 'left']}`}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {rows.map((row, i) => (
          <tr
            key={rowKey(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer hover:bg-white' : undefined}
          >
            {columns.map((col) => (
              <td key={col.key} className={`py-2 pr-4 ${ALIGN[col.align ?? 'left']}`}>
                {col.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
