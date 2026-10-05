import * as api from '../../api';
import { useApi } from '../../lib/hooks';
import type { ReportPeriod } from '../../types';
import { PayrollReport } from './PayrollReport';

export function ShippingReportTab({ period }: { period: ReportPeriod }) {
  const { data, loading } = useApi(() => api.fetchShippingPayroll(), [period.key]);
  return (
    <PayrollReport
      title="Báo cáo phí vận chuyển"
      subtitle="Tiền công vận chuyển theo người giao — chi tiết từng đơn trong kỳ và tổng hợp theo tháng để cộng vào lương."
      itemLabel="Mã đơn"
      report={data}
      loading={loading}
      exportUrl={api.shippingPayrollExportUrl()}
    />
  );
}
