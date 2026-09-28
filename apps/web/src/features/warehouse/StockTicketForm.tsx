import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatNumber, todayISO } from '../../lib/format';
import { stockWarehouses } from '../../lib/warehouses';
import type { StockTicket } from '../../types';
import { IN_REASONS, OUT_REASONS, TICKET_TYPE_LABEL, reasonLabel, type TicketType } from './ticketMeta';

interface Line {
  product_id: string | number;
  quantity: string | number;
  quantity_promo?: number;
  quality?: string;
}

const blankLine = (): Line => ({ product_id: '', quantity: 1, quantity_promo: 0, quality: '' });

const REASONS_FOR_PARTNER = ['PARTNER_RETURN', 'RETURN_BORROW', 'BORROW_IN'];

export function StockTicketForm({
  defaultType,
  ticket,
  onClose,
  onSaved,
}: {
  defaultType: TicketType;
  ticket?: StockTicket;
  onClose: () => void;
  onSaved: (res: { code: string }) => void;
}) {
  const { products, warehouses, partnerUnits, staff } = useReference();
  const sourcesApi = useApi(() => api.importSources.list(), []);
  const toast = useToast();
  const editing = !!ticket;

  const physicalWarehouses = stockWarehouses(warehouses);
  // Dịch vụ không có tồn kho → phiếu kho chỉ chọn hàng bán.
  const stockProducts = products.filter((p) => p.product_type !== 'SERVICE');
  const [ticketType, setTicketType] = useState<TicketType>(ticket?.ticket_type ?? defaultType);
  const [ticketDate, setTicketDate] = useState(ticket?.ticket_date ?? todayISO());
  const [warehouseId, setWarehouseId] = useState(ticket ? String(ticket.warehouse_id) : '');
  const [targetWarehouseId, setTargetWarehouseId] = useState(
    ticket?.target_warehouse_id ? String(ticket.target_warehouse_id) : ''
  );
  const [reason, setReason] = useState(ticket?.reason ?? (defaultType === 'IN' ? 'PARENT_RECEIVE' : ''));
  const [partnerUnitId, setPartnerUnitId] = useState(ticket?.partner_unit_id ? String(ticket.partner_unit_id) : '');
  const [sourceId, setSourceId] = useState(ticket?.source_id ? String(ticket.source_id) : '');
  const [note, setNote] = useState(ticket?.note ?? '');
  const [checkNote, setCheckNote] = useState(ticket?.check_note ?? '');
  const [vehicle, setVehicle] = useState(ticket?.vehicle ?? '');
  const [inChargeId, setInChargeId] = useState(ticket?.in_charge_employee_id ? String(ticket.in_charge_employee_id) : '');
  const [lines, setLines] = useState<Line[]>(
    ticket?.items?.length
      ? ticket.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, quantity_promo: i.quantity_promo ?? 0, quality: i.quality ?? '' }))
      : [blankLine()]
  );
  const [saving, setSaving] = useState(false);

  const isIn = ticketType === 'IN';
  // Kho xuất: cần biết tồn hiện có để biết còn bao nhiêu mà xuất.
  const stockApi = useApi(
    () => (warehouseId ? api.fetchStock(Number(warehouseId)) : Promise.resolve([])),
    [warehouseId]
  );
  const stockByProduct = useMemo(
    () => new Map((stockApi.data ?? []).map((s) => [s.product_id, s.quantity])),
    [stockApi.data]
  );

  const reasons = ticketType === 'IN' ? IN_REASONS : ticketType === 'OUT' ? OUT_REASONS : ['TRANSFER'];
  const showPartner = REASONS_FOR_PARTNER.includes(reason);
  const showSource = reason === 'PARENT_RECEIVE';

  const totalQty = lines.reduce((a, l) => a + (Number(l.quantity) || 0) + (Number(l.quantity_promo) || 0), 0);
  const totalPromo = lines.reduce((a, l) => a + (Number(l.quantity_promo) || 0), 0);
  const totalValue = useMemo(
    () =>
      lines.reduce((a, l) => {
        const p = products.find((x) => x.id === Number(l.product_id));
        return a + (Number(l.quantity) || 0) * (p?.cost_price ?? 0);
      }, 0),
    [lines, products]
  );

  const save = async () => {
    if (!reason) return toast.error('Chọn lý do phiếu');
    if (!warehouseId) return toast.error(ticketType === 'IN' ? 'Chọn kho nhập' : 'Chọn kho xuất');
    if (ticketType === 'TRANSFER' && !targetWarehouseId) return toast.error('Chọn kho nhận điều chuyển');
    if (showPartner && !partnerUnitId) return toast.error('Chọn đối tác');
    const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (!valid.length) return toast.error('Thêm ít nhất một mặt hàng với số lượng > 0');
    // Phiếu xuất/điều chuyển: không được xuất quá tồn kho hiện có.
    if (!isIn) {
      const over = valid.find((l) => Number(l.quantity) > (stockByProduct.get(Number(l.product_id)) ?? 0));
      if (over) {
        const p = products.find((x) => x.id === Number(over.product_id));
        const available = stockByProduct.get(Number(over.product_id)) ?? 0;
        return toast.error(`"${p?.name ?? 'Sản phẩm'}" vượt tồn kho (hiện có ${available}, cần ${Number(over.quantity)})`);
      }
    }
    setSaving(true);
    try {
      const payload = {
        ticket_type: ticketType,
        ticket_date: ticketDate,
        warehouse_id: Number(warehouseId),
        target_warehouse_id: ticketType === 'TRANSFER' ? Number(targetWarehouseId) : null,
        partner_unit_id: showPartner ? Number(partnerUnitId) : null,
        source_id: showSource ? Number(sourceId) || null : null,
        reason,
        check_note: checkNote,
        vehicle,
        in_charge_employee_id: inChargeId ? Number(inChargeId) : null,
        note,
        items: valid.map((l) => ({
          product_id: l.product_id,
          quantity: Number(l.quantity),
          quantity_promo: Number(l.quantity_promo) || 0,
          quality: isIn ? l.quality || null : null,
        })),
      };
      if (editing && ticket) {
        await api.updateStockTicket(ticket.id, payload);
        toast.success(`Đã lưu phiếu ${ticket.code}`);
        onSaved({ code: ticket.code });
      } else {
        const res = await api.createStockTicket(payload);
        toast.success(`Đã tạo phiếu ${res.code} (trạng thái Nháp)`);
        onSaved({ code: res.code });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được phiếu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing && ticket ? `Sửa phiếu ${ticket.code}` : 'Tạo phiếu kho'}
      subtitle="Phiếu lưu ở trạng thái Nháp — bút toán cộng/trừ tồn kho chỉ sinh khi bấm Xác nhận"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu phiếu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <FormGrid cols={3}>
          <Field label="Loại phiếu" required>
            <Select
              disabled={editing}
              value={ticketType}
              onChange={(e) => {
                setTicketType(e.target.value as TicketType);
                setReason('');
              }}
            >
              <option value="IN">{TICKET_TYPE_LABEL.IN}</option>
              <option value="OUT">{TICKET_TYPE_LABEL.OUT}</option>
              <option value="TRANSFER">{TICKET_TYPE_LABEL.TRANSFER}</option>
            </Select>
          </Field>
          <Field label="Ngày phiếu" required>
            <Input type="date" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} />
          </Field>
          <Field label="Lý do" required>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">-- Chọn --</option>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {reasonLabel(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={ticketType === 'IN' ? 'Kho nhập' : 'Kho xuất'} required>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">-- Chọn --</option>
              {physicalWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          {ticketType === 'TRANSFER' && (
            <Field label="Kho nhận" required>
              <Select value={targetWarehouseId} onChange={(e) => setTargetWarehouseId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {physicalWarehouses
                  .filter((w) => String(w.id) !== warehouseId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          {showPartner && (
            <Field label="Đối tác" required>
              <Select value={partnerUnitId} onChange={(e) => setPartnerUnitId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {partnerUnits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {showSource && (
            <Field label="Nguồn nhập">
              <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {(sourcesApi.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Phương tiện" hint="Xe tải, xe điện, xe máy…">
            <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          </Field>
          <Field label="Người phụ trách">
            <Select value={inChargeId} onChange={(e) => setInChargeId(e.target.value)}>
              <option value="">-- Chọn --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600">Hàng hóa</p>
            <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, blankLine()])}>
              <Plus className="h-3.5 w-3.5" /> Thêm dòng
            </Button>
          </div>
          <div className="mb-1 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="flex-1">Sản phẩm</span>
            <span className="w-32 text-center">{isIn ? 'Chất lượng' : 'Tồn kho'}</span>
            <span className="w-28 text-right">Số lượng</span>
            <span className="w-9" />
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const available = stockByProduct.get(Number(l.product_id)) ?? 0;
              const over = !isIn && l.product_id !== '' && Number(l.quantity) + (Number(l.quantity_promo) || 0) > available;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      dense
                      value={String(l.product_id)}
                      onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))}
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {stockProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-32">
                    {isIn ? (
                      <Select
                        dense
                        value={l.quality ?? ''}
                        onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, quality: e.target.value } : x)))}
                      >
                        <option value="">Chưa kiểm</option>
                        <option value="OK">Đạt</option>
                        <option value="NG">Không đạt</option>
                      </Select>
                    ) : (
                      <div
                        className={`flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
                          over ? 'border-brand-red/30 bg-brand-red/5 text-brand-red' : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                        title={over ? 'Vượt tồn kho hiện có' : 'Tồn kho hiện có'}
                      >
                        {l.product_id === '' ? '—' : formatNumber(available)}
                      </div>
                    )}
                  </div>
                  <div className="w-28">
                    <Input
                      dense
                      type="number"
                      value={String(l.quantity)}
                      onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                    />
                  </div>
                  {!!l.quantity_promo && (
                    <span className="w-20 text-right text-xs font-semibold text-amber-600" title="Hàng khuyến mãi đi kèm đơn">
                      KM {formatNumber(l.quantity_promo)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-brand-red" />
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {isIn
              ? 'Kiểm tra hàng = kiểm chất lượng hàng nhập (Đạt / Không đạt cho từng mặt hàng).'
              : 'Kiểm tra hàng = đối chiếu số lượng tồn kho khả dụng trước khi xuất; không được xuất quá tồn.'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Tổng số lượng: <b>{totalQty}</b>
            {totalPromo > 0 && (
              <>
                {' '}
                (trong đó KM: <b className="text-amber-600">{totalPromo}</b>)
              </>
            )}{' '}
            · Giá trị tạm tính theo giá trước thuế: <b>{formatCurrency(totalValue)}</b>
          </p>
        </div>

        {isIn && (
          <Field label="Ghi chú kiểm hàng" hint="Kết quả kiểm tra chất lượng hàng nhập">
            <Input value={checkNote} onChange={(e) => setCheckNote(e.target.value)} />
          </Field>
        )}
        <Field label="Ghi chú">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <p className="text-[11px] text-slate-400">
          Phiếu nhập làm <b>tăng</b> tồn kho; phiếu xuất làm <b>giảm</b> tồn kho (chặn nếu không đủ hàng); phiếu điều chuyển
          chuyển hàng giữa hai kho.
        </p>
      </div>
    </Modal>
  );
}
