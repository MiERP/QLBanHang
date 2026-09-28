import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input, Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { useApi } from '../../lib/hooks';
import { formatDateTime } from '../../lib/format';
import type { AuditLog } from '../../types';

export function AuditLogTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entity, setEntity] = useState('');
  const logsApi = useApi(() => api.fetchAuditLogs({ from, to, entity }), [from, to, entity]);

  const rows = logsApi.data?.rows ?? [];
  const entities = logsApi.data?.entities ?? [];

  const columns: Column<AuditLog>[] = [
    {
      key: 'occurred_at',
      header: 'Thời gian',
      render: (r) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(r.occurred_at)}</span>,
      sortValue: (r) => r.occurred_at,
      searchValue: (r) => formatDateTime(r.occurred_at),
    },
    {
      key: 'entity',
      header: 'Đối tượng',
      render: (r) => <Badge tone="navy">{r.entity}</Badge>,
      sortValue: (r) => r.entity,
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (r) => <span className="font-medium text-slate-700">{r.description}</span>,
      searchValue: (r): string => `${r.description} ${r.entity_code ?? ''}`,
    },
  ];

  return (
    <>
      <PageHeader title="Nhật ký hệ thống" subtitle={`${rows.length} thao tác gần nhất`} />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <Field label="Từ ngày">
          <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Đối tượng">
          <Select dense value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">Tất cả</option>
            {entities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <DataTable<AuditLog>
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        loading={logsApi.loading}
        pageSize={20}
        initialSortKey="occurred_at"
        initialSortDir="desc"
        searchPlaceholder="Tìm theo mô tả..."
        emptyTitle="Chưa có thao tác nào"
        emptyMessage="Nhật ký ghi lại mọi thay đổi dữ liệu kể từ khi bật."
      />
    </>
  );
}
