import { useEffect, useState } from 'react';
import { Field, Input } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
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
// Công ty, theo tháng) và 3 báo cáo tách theo nguồn hàng — chi tiết theo kho / trạm, hàng đi mượn của
// đối tác, báo cáo gộp cho cả xí nghiệp - Công ty - xí nghiệp khác (lọc theo khoảng ngày).
export function RevenueTab({ month, onOpenOrder }: { month: string; onOpenOrder?: (orderId: number) => void }) {
  const [tab, setTab] = useState('trade');
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState(`${month}-31`);

  useEffect(() => {
    setFrom(`${month}-01`);
    setTo(`${month}-31`);
  }, [month]);

  return (
    <>
      <PageHeader
        title="Báo cáo doanh thu"
        subtitle="Doanh thu xí nghiệp theo mặt hàng (mẫu nộp Công ty) và các báo cáo chi tiết, đi mượn, gộp — mỗi báo cáo xuất được Excel riêng."
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs items={TABS} value={tab} onChange={setTab} />
        {tab !== 'trade' && (
          <div className="flex gap-3">
            <Field label="Từ ngày">
              <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Đến ngày">
              <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      {tab === 'trade' && <TradeReportTab month={month} />}
      {tab === 'detail' && <DetailRevenueReport from={from} to={to} />}
      {tab === 'borrowed' && <BorrowedRevenueReport from={from} to={to} onOpenOrder={onOpenOrder} />}
      {tab === 'gross' && <GrossRevenueReport from={from} to={to} />}
    </>
  );
}
