import { useRef, useState } from 'react';
import { DownloadCloud, RotateCcw, Upload } from 'lucide-react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { FREE_SHIP_FOR_CUSTOMER, FREE_SHIP_WITHOUT_SHIPPER, REPORT_PERIOD_FROM, REPORT_PERIOD_TO } from '../../lib/settings';

// Cờ bật/tắt khối sao lưu/khôi phục bằng Excel trong Cấu hình chung.
// Đặt false để tạm ẩn hai nút Xuất/Nhập (API phía sau vẫn giữ nguyên).
const EXCEL_BACKUP_ENABLED = false;

// Khối xuất/nhập TOÀN BỘ dữ liệu qua Excel — tách riêng để bật/tắt bằng một dòng.
function ExcelBackupBlock() {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    window.open(api.backupExportUrl(), '_blank');
  };

  const importBackup = async (file: File) => {
    const ok = await confirm({
      title: 'Khôi phục dữ liệu từ Excel',
      message: `Dữ liệu trong tệp "${file.name}" sẽ được ghi vào hệ thống: dòng có cùng ID thì cập nhật, dòng chưa có ID thì thêm mới. Dữ liệu hiện có không nằm trong tệp vẫn được giữ nguyên.`,
      confirmLabel: 'Khôi phục dữ liệu',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await api.importBackupExcel(file);
      const partial = result.results.filter((r) => r.missing.length);
      const summary = `Đã cập nhật ${result.updated} dòng, thêm mới ${result.inserted} dòng từ ${result.results.length} bảng.`;
      if (partial.length) {
        toast.warning(
          `${summary} Lưu ý: ${partial.length} bảng thiếu cột so với phiên bản hiện tại (${partial
            .map((r) => r.table)
            .join(', ')}) — dữ liệu các cột đó về mặc định. Đang tải lại trang...`
        );
      } else {
        toast.success(`${summary} Đang tải lại trang...`);
      }
      setTimeout(() => window.location.reload(), partial.length ? 5000 : 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không nhập được tệp sao lưu');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={exportBackup} disabled={busy}>
          <DownloadCloud className="h-3.5 w-3.5" /> Xuất toàn bộ dữ liệu (Excel)
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importBackup(file);
          }}
        />
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="h-3.5 w-3.5" /> {busy ? 'Đang xử lý...' : 'Nhập lại dữ liệu từ Excel'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Tệp xuất ra gồm toàn bộ bảng dữ liệu (mỗi bảng một sheet) và nhập lại được nguyên trạng. Nên sao lưu vào cuối mỗi ngày làm
        việc.
      </p>
    </>
  );
}

// Cấu hình chung: các quy tắc nghiệp vụ của hệ thống.
// Lưu ngay và nạp lại dữ liệu tham chiếu để mọi màn hình dùng giá trị mới.
export function GeneralSettingsTab() {
  const { settings, reload } = useReference();
  const toast = useToast();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [dbBusy, setDbBusy] = useState(false);
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

  const resetAll = async () => {
    const first = await confirm({
      title: 'Xóa dữ liệu nghiệp vụ',
      message:
        'Toàn bộ dữ liệu nghiệp vụ (khách hàng, đơn hàng, tồn kho, phiếu kho, sổ quỹ, hóa đơn, nhân viên, cọc vỏ, vỏ bình...) sẽ bị xóa sạch. Danh mục nền vẫn giữ nguyên: nhóm hàng, sản phẩm, bảng giá, phí vận chuyển, khuyến mãi, cọc vỏ, chức vụ, nhóm khách hàng, thuế, kho hiện tại và cấu hình chung. Thao tác này KHÔNG THỂ hoàn tác.',
      confirmLabel: 'Tiếp tục',
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Xác nhận lần cuối',
      message: 'Bạn có chắc chắn muốn xóa sạch toàn bộ dữ liệu? Nếu chưa sao lưu ra Excel, hãy hủy bỏ và sao lưu trước.',
      confirmLabel: 'Xóa sạch dữ liệu',
      danger: true,
    });
    if (!second) return;
    setDbBusy(true);
    try {
      await api.resetDatabase();
      toast.success('Đã đưa dữ liệu về mặc định ban đầu. Đang tải lại trang...');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được dữ liệu');
    } finally {
      setDbBusy(false);
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

      <Card>
        <CardHeader
          title={EXCEL_BACKUP_ENABLED ? 'Sao lưu & khôi phục dữ liệu' : 'Dữ liệu hệ thống'}
          subtitle={
            EXCEL_BACKUP_ENABLED
              ? 'Xuất toàn bộ dữ liệu ra Excel để sao lưu hằng ngày; nếu phần mềm gặp sự cố, nhập lại tệp đó để khôi phục.'
              : 'Các thao tác ảnh hưởng đến toàn bộ dữ liệu của phần mềm.'
          }
        />
        <CardBody>
          {EXCEL_BACKUP_ENABLED && <ExcelBackupBlock />}

          <div className={EXCEL_BACKUP_ENABLED ? 'mt-4 border-t border-slate-100 pt-4' : ''}>
            <div className="text-sm font-semibold text-brand-red">Vùng nguy hiểm</div>
            <p className="mt-1 text-xs text-slate-500">
              Xóa sạch dữ liệu nghiệp vụ: khách hàng, đơn hàng, tồn kho, phiếu kho, sổ quỹ, hóa đơn, nhân viên...
              Danh mục nền vẫn giữ nguyên: nhóm hàng, sản phẩm, bảng giá, phí vận chuyển, khuyến mãi, cọc vỏ, chức vụ, nhóm khách
              hàng, thuế, kho hiện tại và cấu hình chung.
              {EXCEL_BACKUP_ENABLED ? ' Hãy xuất Excel sao lưu trước khi thực hiện.' : ' Thao tác này KHÔNG THỂ hoàn tác.'}
            </p>
            <Button size="sm" variant="danger" className="mt-2" onClick={resetAll} disabled={dbBusy}>
              <RotateCcw className="h-3.5 w-3.5" /> Xóa dữ liệu nghiệp vụ
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
