import { ClipboardCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate } from '../../lib/format';
import type { Dispatch, Settlement } from '../../types';

const DISPATCH_STATUS: Record<string, { label: string; tone: 'amber' | 'cyan' | 'green' | 'red' }> = {
  ASSIGNED: { label: 'Đã phân công', tone: 'amber' },
  IN_TRANSIT: { label: 'Đang giao', tone: 'cyan' },
  DELIVERED: { label: 'Đã giao', tone: 'green' },
  FAILED: { label: 'Giao thất bại', tone: 'red' },
};

export function DeliveryTab({ month }: { month: string }) {
  const { staff } = useReference();
  const [tab, setTab] = useState('dispatches');
  const dispatchesApi = useApi(() => api.fetchDispatches({ month }), [month]);
  const settlementsApi = useApi(() => api.fetchSettlements({ month }), [month]);
  const toast = useToast();

  const [updating, setUpdating] = useState<Dispatch | null>(null);
  const [updateForm, setUpdateForm] = useState<Record<string, unknown>>({});
  const [settling, setSettling] = useState<Dispatch | null>(null);
  const [settleForm, setSettleForm] = useState<Record<string, unknown>>({});

  const openUpdate = (row: Dispatch) => {
    setUpdating(row);
    setUpdateForm({ status: row.status, shipper_employee_id: row.shipper_employee_id, shipping_fee: row.shipping_fee, note: row.note ?? '' });
  };

  const submitUpdate = async () => {
    if (!updating) return;
    try {
      await api.updateDispatch(updating.id, updateForm);
      toast.success('Đã cập nhật phiếu điều phối');
      setUpdating(null);
      dispatchesApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được');
    }
  };

  const openSettle = (row: Dispatch) => {
    setSettling(row);
    setSettleForm({
      cash_collected: row.payment_status === 'PAID' ? row.total_amount : 0,
      cash_turned_in: row.payment_status === 'PAID' ? row.total_amount : 0,
      shells_returned_voi: '',
      shells_returned_up: '',
      shells_lost: 0,
      shipping_fee_paid: row.shipping_fee,
      settled_by: '',
      note: '',
    });
  };

  const submitSettle = async () => {
    if (!settling) return;
    try {
      await api.createSettlement({ ...settleForm, dispatch_id: settling.id, shipper_employee_id: settling.shipper_employee_id });
      toast.success('Đã quyết toán ca giao hàng');
      setSettling(null);
      dispatchesApi.reload();
      settlementsApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không quyết toán được');
    }
  };

  const dispatchColumns: Column<Dispatch>[] = [
    { key: 'dispatch_code', header: 'Mã điều phối', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.dispatch_code },
    { key: 'order_code', header: 'Đơn hàng', render: (r) => r.order_code },
    { key: 'delivery_date', header: 'Ngày giao', render: (r) => formatDate(r.delivery_date ?? r.order_date), sortValue: (r) => r.order_date },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    { key: 'shipper_name', header: 'Người giao', sortValue: (r) => r.shipper_name },
    { key: 'shipping_fee', header: 'Phí ship', align: 'right', render: (r) => formatCurrency(r.shipping_fee), sortValue: (r) => r.shipping_fee },
    { key: 'total_amount', header: 'Tiền hàng', align: 'right', render: (r) => formatCurrency(r.total_amount), sortValue: (r) => r.total_amount },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => <Badge tone={DISPATCH_STATUS[r.status]?.tone ?? 'neutral'}>{DISPATCH_STATUS[r.status]?.label ?? r.status}</Badge>,
      sortValue: (r) => r.status,
    },
  ];

  const settlementColumns: Column<Settlement>[] = [
    { key: 'settled_at', header: 'Thời điểm', render: (r) => formatDate(r.settled_at), sortValue: (r) => r.settled_at },
    { key: 'dispatch_code', header: 'Mã điều phối', className: 'font-mono' },
    { key: 'order_code', header: 'Đơn hàng' },
    { key: 'shipper_name', header: 'Người giao' },
    { key: 'cash_collected', header: 'Tiền thu', align: 'right', render: (r) => formatCurrency(r.cash_collected) },
    { key: 'cash_turned_in', header: 'Tiền nộp quỹ', align: 'right', render: (r) => formatCurrency(r.cash_turned_in) },
    { key: 'shells_returned_voi', header: 'Vỏ Vòi', align: 'center' },
    { key: 'shells_returned_up', header: 'Vỏ Úp', align: 'center' },
    { key: 'shells_lost', header: 'Vỏ mất', align: 'center', render: (r) => (r.shells_lost ? <span className="font-bold text-brand-red">{r.shells_lost}</span> : '—') },
    { key: 'shipping_fee_paid', header: 'Phí ship trả', align: 'right', render: (r) => formatCurrency(r.shipping_fee_paid) },
  ];

  return (
    <>
      <PageHeader
        title="Giao hàng & Quyết toán"
        subtitle="Điều phối shipper, theo dõi trạng thái giao và quyết toán tiền/vỏ theo ca"
        actions={
          <Tabs
            items={[
              { id: 'dispatches', label: 'Phiếu điều phối', icon: Truck },
              { id: 'settlements', label: 'Quyết toán ca', icon: ClipboardCheck },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      {tab === 'dispatches' && (
        <DataTable
          columns={dispatchColumns}
          data={dispatchesApi.data ?? []}
          rowKey={(r) => r.id}
          loading={dispatchesApi.loading}
          onRowClick={openUpdate}
          searchPlaceholder="Tìm theo mã phiếu, đơn hàng, khách hàng..."
          initialSortKey="dispatch_code"
          initialSortDir="desc"
          toolbar={
            <Button variant="secondary" size="sm" onClick={() => dispatchesApi.data?.[0] && openSettle(dispatchesApi.data[0])}>
              Quyết toán ca đầu tiên
            </Button>
          }
        />
      )}

      {tab === 'settlements' && (
        <DataTable columns={settlementColumns} data={settlementsApi.data ?? []} rowKey={(r) => r.id} loading={settlementsApi.loading} searchPlaceholder="Tìm theo mã, người giao..." />
      )}

      <Modal
        open={!!updating}
        onClose={() => setUpdating(null)}
        size="md"
        title={updating ? `Điều phối ${updating.dispatch_code}` : ''}
        subtitle={updating ? `${updating.order_code} · ${updating.customer_name}` : ''}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setUpdating(null)}>
              Đóng
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (updating) {
                  const row = updating;
                  setUpdating(null);
                  openSettle(row);
                }
              }}
            >
              <ClipboardCheck className="h-4 w-4" /> Quyết toán ca này
            </Button>
            <Button size="sm" onClick={submitUpdate}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        {updating && (
          <div className="space-y-3 p-5">
            <FormGrid cols={2}>
              <Field label="Trạng thái giao hàng">
                <Select value={String(updateForm.status ?? '')} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                  {Object.entries(DISPATCH_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Người giao hàng">
                <Select value={String(updateForm.shipper_employee_id ?? '')} onChange={(e) => setUpdateForm({ ...updateForm, shipper_employee_id: e.target.value })}>
                  {staff
                    .filter((s) => s.role_id === 4)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Phí vận chuyển">
                <Input type="number" value={String(updateForm.shipping_fee ?? '')} onChange={(e) => setUpdateForm({ ...updateForm, shipping_fee: e.target.value })} />
              </Field>
            </FormGrid>
            <Field label="Ghi chú">
              <Input value={String(updateForm.note ?? '')} onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!settling}
        onClose={() => setSettling(null)}
        size="md"
        title={settling ? `Quyết toán ca ${settling.dispatch_code}` : ''}
        subtitle={settling ? `${settling.shipper_name} · ${settling.customer_name}` : ''}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettling(null)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitSettle}>
              Xác nhận quyết toán
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Tiền thu từ khách">
              <Input type="number" value={String(settleForm.cash_collected ?? '')} onChange={(e) => setSettleForm({ ...settleForm, cash_collected: e.target.value })} />
            </Field>
            <Field label="Tiền nộp về quỹ">
              <Input type="number" value={String(settleForm.cash_turned_in ?? '')} onChange={(e) => setSettleForm({ ...settleForm, cash_turned_in: e.target.value })} />
            </Field>
            <Field label="Vỏ Vòi thu hồi">
              <Input type="number" value={String(settleForm.shells_returned_voi ?? '')} onChange={(e) => setSettleForm({ ...settleForm, shells_returned_voi: e.target.value })} />
            </Field>
            <Field label="Vỏ Úp thu hồi">
              <Input type="number" value={String(settleForm.shells_returned_up ?? '')} onChange={(e) => setSettleForm({ ...settleForm, shells_returned_up: e.target.value })} />
            </Field>
            <Field label="Vỏ mất / hư hỏng">
              <Input type="number" value={String(settleForm.shells_lost ?? '')} onChange={(e) => setSettleForm({ ...settleForm, shells_lost: e.target.value })} />
            </Field>
            <Field label="Phí vận chuyển trả shipper">
              <Input type="number" value={String(settleForm.shipping_fee_paid ?? '')} onChange={(e) => setSettleForm({ ...settleForm, shipping_fee_paid: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label="Người quyết toán">
            <Select value={String(settleForm.settled_by ?? '')} onChange={(e) => setSettleForm({ ...settleForm, settled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={String(settleForm.note ?? '')} onChange={(e) => setSettleForm({ ...settleForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
