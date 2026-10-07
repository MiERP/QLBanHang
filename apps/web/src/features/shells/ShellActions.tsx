import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { formatCurrency } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { getWorkingDate } from '../../lib/workingDate';

export interface ShellActionTarget {
  customerId: number;
  customerName: string;
  debtVoi: number;
  debtUp: number;
  /** Đơn đang thao tác (nếu có) — phiếu thu hồi sẽ gắn vào đơn này. */
  orderId?: number | null;
  /** Số vỏ gợi ý sẵn cho phiếu thu hồi (số còn lại của đơn). */
  defaultVoi?: number;
  defaultUp?: number;
}

// Cụm 3 nghiệp vụ vỏ của một khách: thu hồi (trả vỏ), tất toán toàn bộ, và vỏ mất / mua đứt.
// Dùng chung cho bảng vỏ & cọc để mỗi dòng đơn đều thao tác được ngay.
export function ShellActions({ target, onDone }: { target: ShellActionTarget; onDone?: () => void }) {
  const { staff, products } = useReference();
  const shellDepositsApi = useApi(() => api.shellDeposits.list(), []);
  const toast = useToast();

  const [returnOpen, setReturnOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({ returned_voi: '', returned_up: '', handled_by: '', refund_deposit: '1', payment_method: 'CASH', note: '' });
  const [settleForm, setSettleForm] = useState({ payment_method: 'CASH', handled_by: '', note: '' });
  const [writeOffForm, setWriteOffForm] = useState({ shells_voi: '', shells_up: '', reason: 'Vỏ mất', handled_by: '', note: '' });

  const shellFee = useMemo(() => {
    const feeOf = (type: 'VOI' | 'UP') => {
      const configured = (shellDepositsApi.data ?? []).find((row) => row.bottle_type === type);
      if (configured && Number(configured.deposit_fee) > 0) return Number(configured.deposit_fee);
      const product = (products ?? []).find((p) => p.bottle_type === type && Number(p.deposit_fee) > 0);
      return Number(product?.deposit_fee) || 0;
    };
    return { feeVoi: feeOf('VOI'), feeUp: feeOf('UP') };
  }, [shellDepositsApi.data, products]);

  const openReturn = () => {
    const voi = Math.min(Number(target.defaultVoi) || 0, target.debtVoi);
    const up = Math.min(Number(target.defaultUp) || 0, target.debtUp);
    setReturnForm({
      returned_voi: voi ? String(voi) : '',
      returned_up: up ? String(up) : '',
      handled_by: '',
      refund_deposit: '1',
      payment_method: 'CASH',
      note: '',
    });
    setReturnOpen(true);
  };

  const run = async (fn: () => Promise<unknown>, okMessage: (res: never) => string, fail: string) => {
    try {
      const res = (await fn()) as never;
      toast.success(okMessage(res));
      setReturnOpen(false);
      setSettleOpen(false);
      setWriteOffOpen(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fail);
    }
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button variant="secondary" size="sm" onClick={openReturn}>
          <RotateCcw className="h-3.5 w-3.5" /> Trả vỏ
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSettleForm({ payment_method: 'CASH', handled_by: '', note: '' });
            setSettleOpen(true);
          }}
        >
          Tất toán
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setWriteOffForm({ shells_voi: '', shells_up: '', reason: 'Vỏ mất', handled_by: '', note: '' });
            setWriteOffOpen(true);
          }}
        >
          Mất / mua đứt
        </Button>
      </div>

      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        size="sm"
        title="Thu hồi vỏ bình"
        subtitle={`${target.customerName} · khách đang giữ Vòi ${target.debtVoi} / Úp ${target.debtUp}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setReturnOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run(
                  () => api.returnBottles(target.customerId, { ...returnForm, order_id: target.orderId ?? undefined, transaction_date: getWorkingDate() }),
                  (res: { deposit_refund: number }) =>
                    res.deposit_refund ? `Đã thu hồi vỏ và hoàn cọc ${formatCurrency(res.deposit_refund)}` : 'Đã ghi nhận thu hồi vỏ (không hoàn cọc)',
                  'Không thực hiện được'
                )
              }
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
              Tiền hoàn dự kiến:{' '}
              <b className="text-slate-700">
                {formatCurrency((Number(returnForm.returned_voi) || 0) * shellFee.feeVoi + (Number(returnForm.returned_up) || 0) * shellFee.feeUp)}
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
        subtitle={`${target.customerName} · Vòi ${target.debtVoi} / Úp ${target.debtUp}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettleOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run(
                  () => api.settleShells(target.customerId, { ...settleForm, transaction_date: getWorkingDate() }),
                  (res: { shells_voi: number; shells_up: number; deposit_refund: number }) =>
                    `Đã thu hồi ${res.shells_voi} vỏ Vòi + ${res.shells_up} vỏ Úp, hoàn cọc ${formatCurrency(res.deposit_refund)}`,
                  'Không tất toán được'
                )
              }
            >
              Xác nhận tất toán
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            Thu hồi <b>toàn bộ</b> vỏ khách đang giữ và hoàn lại tiền cọc theo phí cọc đang áp.
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Thu hồi: Vòi <b>{target.debtVoi}</b> · Úp <b>{target.debtUp}</b> — tiền cọc hoàn dự kiến{' '}
            <b className="text-brand-navy">{formatCurrency(target.debtVoi * shellFee.feeVoi + target.debtUp * shellFee.feeUp)}</b>
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
        subtitle={`${target.customerName} · Vòi ${target.debtVoi} / Úp ${target.debtUp}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setWriteOffOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run(
                  () => api.writeOffShells(target.customerId, { ...writeOffForm, transaction_date: getWorkingDate() }),
                  (res: { newVoi: number; newUp: number }) => `Đã trừ nợ vỏ (còn Vòi ${res.newVoi} · Úp ${res.newUp}) — tiền cọc được giữ lại`,
                  'Không ghi nhận được'
                )
              }
            >
              Xác nhận
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            Khách báo mất vỏ hoặc mua đứt: nợ vỏ giảm nhưng <b>tiền cọc đã thu được giữ lại</b> (không hoàn).
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
