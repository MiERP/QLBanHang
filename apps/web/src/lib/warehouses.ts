import type { Warehouse } from '../types';

// Kho chứa hàng thật (có tồn kho để đối soát): bỏ kho ảo (trung chuyển / mượn)
// và nút "Khách hàng" — đó chỉ là điểm giao trong tuyến vận chuyển.
export const isStockWarehouse = (w: Warehouse) => w.type !== 'VIRTUAL' && w.type !== 'CUSTOMER';

export const stockWarehouses = (list: Warehouse[]) => list.filter(isStockWarehouse);
