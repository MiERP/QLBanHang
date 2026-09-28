import { FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import * as api from '../../api';
import type { ImportKind, ImportRowError } from '../../api';
import { Button } from './Button';
import { Modal } from './Modal';
import { SubTable } from './SubTable';
import { useToast } from './Toast';

const DEFAULT_HINT =
  'Nên nhập danh mục (nhóm hàng, nhóm khách hàng, kho, đơn vị, nhân viên, sản phẩm, khách hàng) trước, sau đó tới tồn kho đầu kỳ và đơn hàng.';

const MAX_ERROR_ROWS = 100;

interface Props {
  kind: ImportKind;
  label?: string;
  hint?: string;
  allowUpsert?: boolean;
  onDone: () => void;
}

export function ImportExcelButton({ kind, label = 'Nhập Excel', hint, allowUpsert = true, onDone }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [upsert, setUpsert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<ImportRowError[]>([]);

  const reset = () => {
    setFile(null);
    setErrors([]);
    setUpsert(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await api.uploadImportExcel(kind, file, upsert ? 'upsert' : 'strict');
      toast.success(result.message || `Đã nhập ${result.imported} dòng`);
      onDone();
      setOpen(false);
      reset();
    } catch (e) {
      const rows = e instanceof api.ApiError ? ((e.details as { errors?: ImportRowError[] } | undefined)?.errors ?? []) : [];
      setErrors(rows);
      toast.error(e instanceof Error ? e.message : 'Không nhập được tệp');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> {label}
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Nhập dữ liệu từ Excel"
        subtitle="Hệ thống kiểm tra toàn bộ tệp trước khi ghi — có lỗi thì không nhập dòng nào"
        size="xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close} disabled={busy}>
              Đóng
            </Button>
            <Button size="sm" onClick={submit} disabled={!file || busy}>
              <Upload className="h-3.5 w-3.5" /> {busy ? 'Đang nhập...' : 'Bắt đầu nhập'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 p-5">
          <div className="rounded-lg bg-brand-cyan-subtle px-3 py-2 text-xs text-brand-navy">{hint ?? DEFAULT_HINT}</div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div>
              <div className="text-sm font-semibold text-slate-700">Bước 1 — Tải tệp mẫu</div>
              <div className="text-xs text-slate-500">Tệp mẫu có sẵn sheet "Hướng dẫn" mô tả từng cột và giá trị hợp lệ.</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.open(api.importTemplateUrl(kind), '_blank')}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Tải file mẫu
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-700">Bước 2 — Chọn tệp đã điền</div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErrors([]);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
                Chọn tệp .xlsx
              </Button>
              <span className="text-xs text-slate-500">{file ? file.name : 'Chưa chọn tệp nào'}</span>
            </div>
            {allowUpsert && (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={upsert}
                  disabled={busy}
                  onChange={(e) => setUpsert(e.target.checked)}
                />
                Cập nhật bản ghi đã tồn tại theo mã (thay vì báo lỗi trùng mã)
              </label>
            )}
            <div className="text-xs text-slate-400">Chỉ hỗ trợ tệp .xlsx. Tệp cũ .xls cần lưu lại dưới dạng .xlsx.</div>
          </div>

          {errors.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-brand-red">
                Tệp chưa được nhập — sửa các lỗi sau rồi tải lên lại:
              </div>
              <SubTable<ImportRowError>
                columns={[
                  { key: 'row', header: 'Dòng', align: 'center', render: (r) => r.row },
                  { key: 'message', header: 'Lỗi', render: (r) => r.message },
                ]}
                rows={errors.slice(0, MAX_ERROR_ROWS)}
                rowKey={(r, index) => `${r.row}-${index}`}
                emptyText=""
              />
              {errors.length > MAX_ERROR_ROWS && (
                <div className="text-xs text-slate-500">Còn {errors.length - MAX_ERROR_ROWS} lỗi khác chưa hiển thị.</div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
