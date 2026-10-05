import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import type { ReportPeriod } from '../../types';
import { TradeReportTab } from '../reports/TradeReportTab';
import { BorrowedRevenueReport } from './BorrowedRevenueReport';
import { DetailRevenueReport } from './DetailRevenueReport';
import { GrossRevenueReport } from './GrossRevenueReport';

const TABS = [
  { id: 'trade', label: 'Doanh thu xí nghiệp' },
  { id: 'detail', label: 'Xí nghiệp chi tiết' },
  { id: 'borrowed', label: 'Đơn hàng đi mượn' },
  { id: 'gross', label: 'Doanh thu gộp' },
];

// Mọi báo cáo doanh thu nằm chung một màn: doanh thu xí nghiệp theo mặt hàng (báo cáo thương mại nộp
// Công ty) và 3 báo cáo tách theo nguồn hàng — chi tiết theo kho / trạm, hàng đi mượn của đối tác,
// báo cáo gộp cho cả xí nghiệp - Công ty - xí nghiệp khác. Tất cả gom theo kỳ báo cáo hiện tại.
export function RevenueTab({ period, onOpenOrder }: { period: ReportPeriod; onOpenOrder?: (orderId: number) => void }) {
  const [tab, setTab] = useState('trade');

  return (
    <>
      <PageHeader
        title="Báo cáo doanh thu"
        subtitle="Doanh thu xí nghiệp theo mặt hàng (mẫu nộp Công ty) và các báo cáo chi tiết, đi mượn, gộp — mỗi báo cáo xuất được Excel riêng."
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'trade' && <TradeReportTab period={period} />}
      {tab === 'detail' && <DetailRevenueReport from={period.from} to={period.to} />}
      {tab === 'borrowed' && <BorrowedRevenueReport from={period.from} to={period.to} onOpenOrder={onOpenOrder} />}
      {tab === 'gross' && <GrossRevenueReport from={period.from} to={period.to} />}
    </>
  );
}
