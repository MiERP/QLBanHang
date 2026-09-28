import { useState } from 'react';
import * as api from '../../api';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { FREE_SHIP_WITHOUT_SHIPPER } from '../../lib/settings';

// Cấu hình chung: các quy tắc nghiệp vụ bật/tắt của hệ thống.
// Lưu ngay khi tick và nạp lại dữ liệu tham chiếu để mọi màn hình dùng giá trị mới.
export function GeneralSettingsTab() {
  const { settings, reload } = useReference();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const freeShip = settings[FREE_SHIP_WITHOUT_SHIPPER] === '1';

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

  return (
    <div className="space-y-3">
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
        </CardBody>
      </Card>
    </div>
  );
}
