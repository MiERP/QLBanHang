import * as api from '../../api';
import { useApi } from '../../lib/hooks';
import { PayrollReport } from './PayrollReport';

export function ShippingReportTab({ month }: { month: string }) {
  const { data, loading } = useApi(() => api.fetchShippingPayroll(month), [month]);
  return (
    <PayrollReport
      title="Báo cáo phí vận chuyển"
      subtitle="Tiền công vận chuyển theo người giao — chi tiết từng đơn trong tháng và tổng hợp theo tháng để cộng vào lương."
      itemLabel="Mã đơn"
      report={data}
      loading={loading}
      exportUrl={api.shippingPayrollExportUrl(month)}
    />
  );
}
