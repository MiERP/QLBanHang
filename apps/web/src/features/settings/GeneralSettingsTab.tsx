import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { FREE_SHIP_FOR_CUSTOMER, FREE_SHIP_WITHOUT_SHIPPER, REPORT_PERIOD_FROM, REPORT_PERIOD_TO } from '../../lib/settings';

// Cấu hình chung: các quy tắc nghiệp vụ của hệ thống.
// Lưu ngay và nạp lại dữ liệu tham chiếu để mọi màn hình dùng giá trị mới.
export function GeneralSettingsTab() {
  const { settings, reload } = useReference();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const freeShip = settings[FREE_SHIP_WITHOUT_SHIPPER] === '1';
  const freeShipCustomer = settings[FREE_SHIP_FOR_CUSTOMER] === '1';

  const [periodFrom, setPeriodFrom] = useState(settings[REPORT_PERIOD_FROM] ?? '');
  const [periodTo, setPeriodTo] = useState(settings[REPORT_PERIOD_TO] ?? '');

  const toggleFreeShip = async (next: boolean) => {
    setSaving(true);
    try {
      await api.updateSettings({ [FREE_SHIP_WITHOUT_SHIPPER]: next ? '1' : '0' });
      await reload();
      toast.success(
        next
          ? 'Đã bật: đơn không có nhân viên vận chuyển là đơn miễn ship'
          : 'Đã tắt: bắt buộc chọn nhân viên vận chuyển khi lưu đơn'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const toggleFreeShipCustomer = async (next: boolean) => {
    setSaving(true);
    try {
      await api.updateSettings({ [FREE_SHIP_FOR_CUSTOMER]: next ? '1' : '0' });
      await reload();
      toast.success(next ? 'Đã bật: miễn ship cho khách' : 'Đã tắt: miễn ship cho khách');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const savePeriod = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ [REPORT_PERIOD_FROM]: periodFrom, [REPORT_PERIOD_TO]: periodTo });
      await reload();
      toast.success('Đã lưu kỳ báo cáo');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được kỳ báo cáo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader
          title="Kỳ báo cáo"
          subtitle="Khoảng thời gian doanh thu, chi phí, bảng lương, chỉ tiêu và cọc vỏ được gom lại. Để trống cả hai ô = tự dùng tháng dương lịch hiện tại."
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <Field label="Từ ngày">
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </Field>
            <Field label="Đến ngày">
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </Field>
            <Button size="sm" onClick={savePeriod} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu kỳ báo cáo'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Thay đổi áp dụng ngay cho mọi màn báo cáo, bảng điều khiển, chỉ tiêu KPI, bảng lương và cọc vỏ.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Quy tắc vận chuyển"
          subtitle="Cách hệ thống xử lý đơn hàng không gán nhân viên vận chuyển."
        />
        <CardBody>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-cyan"
              checked={freeShip}
              disabled={saving}
              onChange={(e) => toggleFreeShip(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-700">
                Đơn không có nhân viên vận chuyển là đơn miễn ship
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Bật: đơn để trống người giao được coi là đơn miễn ship — không vào báo cáo phí vận chuyển và bảng lương giao hàng.
                Tắt: bắt buộc chọn người giao khi lưu đơn.
              </span>
            </span>
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 border-t border-slate-100 pt-4">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-cyan"
              checked={freeShipCustomer}
              disabled={saving}
              onChange={(e) => toggleFreeShipCustomer(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-700">
                Miễn ship cho khách
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Bật: khách chỉ trả tiền hàng, không trả phí ship; phí ship vẫn được tính và ghi nhận để xí nghiệp trả công nhân viên giao hàng cuối kỳ báo cáo.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>
    </div>
  );
}
