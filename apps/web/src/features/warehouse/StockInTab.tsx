import { PageHeader } from '../../components/ui/PageHeader';
import { StockTicketsPanel } from './StockTicketsPanel';

export function StockInTab() {
  return (
    <>
      <PageHeader title="Nhập kho" subtitle="Phiếu nhập và trạng thái ghi sổ tồn kho" />
      <StockTicketsPanel direction="IN" />
    </>
  );
}
