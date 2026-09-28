import { PageHeader } from '../../components/ui/PageHeader';
import { OrderForm } from '../orders/OrderForm';

export function CreateOrderTab() {
  return (
    <>
      <PageHeader
        title="Tạo đơn bán hàng"
        subtitle="Đơn được lưu ở trạng thái Nháp — xác nhận & giao hàng ở màn Đơn hàng"
      />
      <OrderForm />
    </>
  );
}
