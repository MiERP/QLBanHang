import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { formatCurrency, formatDate } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import type { BottleLedger } from '../../types';

const ledgerColumns: Column<BottleLedger>[] = [
  { key: 'transaction_date', header: 'Ngày', render: (r) => formatDate(r.transaction_date), sortValue: (r) => r.transaction_date },
  { key: 'order_code', header: 'Đơn hàng', render: (r) => r.order_code ?? '—' },
  { key: 'borrowed_voi', header: 'Xuất Vòi', align: 'center' },
  { key: 'borrowed_up', header: 'Xuất Úp', align: 'center' },
  { key: 'returned_voi', header: 'Trả Vòi', align: 'center' },
  { key: 'returned_up', header: 'Trả Úp', align: 'center' },
  { key: 'remaining_balance_voi', header: 'Còn Vòi', align: 'center', render: (r) => <b className="text-brand-navy">{r.remaining_balance_voi}</b> },
  { key: 'remaining_balance_up', header: 'Còn Úp', align: 'center', render: (r) => <b className="text-indigo-600">{r.remaining_balance_up}</b> },
  { key: 'handler_name', header: 'Người xử lý', render: (r) => r.handler_name ?? '—' },
];

export interface ShellCustomerRef {
  id: number;
  name: string;
  debt_voi: number;
  debt_up: number;
}

// Khối thao tác vỏ của MỘT khách: nhật ký vỏ + 3 nghiệp vụ (thu hồi/hoàn cọc, tất toán, mất/mua đứt).
// Dùng trong màn "Vỏ bình & cọc" → tab Theo khách (mở rộng từng dòng), là nơi quản lý duy nhất.
export function CustomerShellPanel({ customer, onChanged }: { customer: ShellCustomerRef; onChanged?: () => void }) {
  const { staff, products } = useReference();
  const shellDepositsApi = useApi(() => api.shellDeposits.list(), []);
  const ledgersApi = useApi(() => api.fetchBottleLedgers(customer.id), [customer.id]);
  const toast = useToast();

  const [returnOpen, setReturnOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [settleForm, setSettleForm] = useState({ payment_method: 'CASH', handled_by: '', note: '' });
  const [writeOffForm, setWriteOffForm] = useState({ shells_voi: '', shells_up: '', reason: 'Vỏ mất', handled_by: '', note: '' });
  const [returnForm, setReturnForm] = useState({
    returned_voi: '',
    returned_up: '',
    handled_by: '',
    refund_deposit: '1',
    payment_method: 'CASH',
    note: '',
  });

  // Phí cọc theo loại vỏ: lấy từ danh mục "Cọc vỏ bình", chưa cấu hình thì theo sản phẩm bình đang bán.
  const shellFee = useMemo(() => {
    const feeOf = (type: 'VOI' | 'UP') => {
      const configured = (shellDepositsApi.data ?? []).find((row) => row.bottle_type === type);
      if (configured && Number(configured.deposit_fee) > 0) return Number(configured.deposit_fee);
      const product = (products ?? []).find((p) => p.bottle_type === type && Number(p.deposit_fee) > 0);
      return Number(product?.deposit_fee) || 0;
    };
    return { feeVoi: feeOf('VOI'), feeUp: feeOf('UP') };
  }, [shellDepositsApi.data, products]);

  const afterChange = () => {
    ledgersApi.reload();
    onChanged?.();
  };

  return (
    <>
      <DataTable
        columns={ledgerColumns}
        data={ledgersApi.data ?? []}
        rowKey={(r) => r.id}
        loading={ledgersApi.loading}
        searchable={false}
        initialSortKey="transaction_date"
        initialSortDir="desc"
        emptyTitle="Chưa có phát sinh vỏ"
        emptyMessage="Khách hàng này chưa có lịch sử vỏ bình."
        toolbar={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setReturnForm({ returned_voi: '', returned_up: '', handled_by: '', refund_deposit: '1', payment_method: 'CASH', note: '' });
                setReturnOpen(true);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Ghi nhận thu hồi vỏ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSettleForm({ payment_method: 'CASH', handled_by: '', note: '' });
                setSettleOpen(true);
              }}
            >
              Tất toán vỏ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWriteOffForm({ shells_voi: '', shells_up: '', reason: 'Vỏ mất', handled_by: '', note: '' });
                setWriteOffOpen(true);
              }}
            >
              Vỏ mất / mua đứt
            </Button>
          </>
        }
      />

      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        size="sm"
        title="Ghi nhận thu hồi vỏ bình"
        subtitle={`${customer.name} · Vòi ${customer.debt_voi} / Úp ${customer.debt_up}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setReturnOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await api.returnBottles(customer.id, returnForm);
                  toast.success(
                    res.deposit_refund
                      ? `Đã thu hồi vỏ và hoàn cọc ${formatCurrency(res.deposit_refund)}`
                      : 'Đã ghi nhận thu hồi vỏ (không hoàn cọc)'
                  );
                  setReturnOpen(false);
                  afterChange();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
                }
              }}
            >
              Xác nhận thu hồi
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Số vỏ Vòi trả">
              <Input type="number" value={returnForm.returned_voi} onChange={(e) => setReturnForm({ ...returnForm, returned_voi: e.target.value })} />
            </Field>
            <Field label="Số vỏ Úp trả">
              <Input type="number" value={returnForm.returned_up} onChange={(e) => setReturnForm({ ...returnForm, returned_up: e.target.value })} />
            </Field>
          </FormGrid>
          <div className="rounded-lg border border-slate-200 p-3">
            <FormGrid cols={2}>
              <Field label="Hoàn cọc">
                <Select value={returnForm.refund_deposit} onChange={(e) => setReturnForm({ ...returnForm, refund_deposit: e.target.value })}>
                  <option value="1">Hoàn tiền cọc cho số vỏ trả</option>
                  <option value="0">Không hoàn (đã xử lý ở chỗ khác)</option>
                </Select>
              </Field>
              <Field label="Hình thức hoàn">
                <Select value={returnForm.payment_method} onChange={(e) => setReturnForm({ ...returnForm, payment_method: e.target.value })}>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                </Select>
              </Field>
            </FormGrid>
            <p className="mt-1 text-right text-[11px] text-slate-500">
              Tiền cọc hoàn theo phí cọc đang áp: Vòi {formatCurrency(shellFee.feeVoi)} · Úp {formatCurrency(shellFee.feeUp)} — tiền hoàn dự
              kiến{' '}
              <b className="text-slate-700">
                {formatCurrency(
                  (Number(returnForm.returned_voi) || 0) * shellFee.feeVoi + (Number(returnForm.returned_up) || 0) * shellFee.feeUp
                )}
              </b>
            </p>
          </div>
          <Field label="Người thu hồi">
            <Select value={returnForm.handled_by} onChange={(e) => setReturnForm({ ...returnForm, handled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={returnForm.note} onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        size="sm"
        title="Tất toán vỏ bình"
        subtitle={`${customer.name} · Vòi ${customer.debt_voi} / Úp ${customer.debt_up}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettleOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await api.settleShells(customer.id, settleForm);
                  toast.success(
                    `Đã thu hồi ${res.shells_voi} vỏ Vòi + ${res.shells_up} vỏ Úp và hoàn cọc ${formatCurrency(res.deposit_refund)}`
                  );
                  setSettleOpen(false);
                  afterChange();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Không tất toán được');
                }
              }}
            >
              Xác nhận tất toán
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            Hệ thống thu hồi <b>toàn bộ</b> vỏ khách đang giữ, nhập về kho vỏ bình và hoàn lại tiền cọc theo phí cọc đang áp.
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Thu hồi: Vòi <b>{customer.debt_voi}</b> · Úp <b>{customer.debt_up}</b> — tiền cọc hoàn dự kiến{' '}
            <b className="text-brand-navy">
              {formatCurrency(customer.debt_voi * shellFee.feeVoi + customer.debt_up * shellFee.feeUp)}
            </b>
          </p>
          <Field label="Hình thức hoàn cọc">
            <Select value={settleForm.payment_method} onChange={(e) => setSettleForm({ ...settleForm, payment_method: e.target.value })}>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </Select>
          </Field>
          <Field label="Người thực hiện">
            <Select value={settleForm.handled_by} onChange={(e) => setSettleForm({ ...settleForm, handled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={settleForm.note} onChange={(e) => setSettleForm({ ...settleForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={writeOffOpen}
        onClose={() => setWriteOffOpen(false)}
        size="sm"
        title="Vỏ không trả lại"
        subtitle={`${customer.name} · Vòi ${customer.debt_voi} / Úp ${customer.debt_up}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setWriteOffOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await api.writeOffShells(customer.id, writeOffForm);
                  toast.success(`Đã trừ nợ vỏ (còn Vòi ${res.newVoi} · Úp ${res.newUp}) — tiền cọc được giữ lại`);
                  setWriteOffOpen(false);
                  afterChange();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Không ghi nhận được');
                }
              }}
            >
              Xác nhận
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            Dùng khi khách báo mất vỏ hoặc mua đứt vỏ: nợ vỏ giảm nhưng <b>tiền cọc đã thu được giữ lại</b> (không hoàn).
          </p>
          <FormGrid cols={2}>
            <Field label="Số vỏ Vòi">
              <Input type="number" value={writeOffForm.shells_voi} onChange={(e) => setWriteOffForm({ ...writeOffForm, shells_voi: e.target.value })} />
            </Field>
            <Field label="Số vỏ Úp">
              <Input type="number" value={writeOffForm.shells_up} onChange={(e) => setWriteOffForm({ ...writeOffForm, shells_up: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label="Lý do">
            <Select value={writeOffForm.reason} onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.target.value })}>
              <option value="Vỏ mất">Vỏ mất</option>
              <option value="Khách mua đứt">Khách mua đứt</option>
              <option value="Hư hỏng">Hư hỏng</option>
              <option value="Khác">Khác</option>
            </Select>
          </Field>
          <Field label="Người ghi nhận">
            <Select value={writeOffForm.handled_by} onChange={(e) => setWriteOffForm({ ...writeOffForm, handled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={writeOffForm.note} onChange={(e) => setWriteOffForm({ ...writeOffForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
