import type { AppSettings } from '../types';

// Khoá cấu hình hệ thống — trùng với apps/api/src/lib/appSettings.ts.
export const FREE_SHIP_WITHOUT_SHIPPER = 'free_ship_without_shipper';

// Đơn không gán người giao được coi là đơn miễn ship: không phát sinh tiền công giao hàng cho ai.
// Tắt (mặc định) thì bắt buộc chọn người giao khi lưu đơn.
export const freeShipWithoutShipper = (settings: AppSettings | undefined): boolean =>
  settings?.[FREE_SHIP_WITHOUT_SHIPPER] === '1';
