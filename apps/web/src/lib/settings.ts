import type { AppSettings } from '../types';

// Khoá cấu hình hệ thống — trùng với apps/api/src/lib/appSettings.ts.
export const FREE_SHIP_WITHOUT_SHIPPER = 'free_ship_without_shipper';
export const FREE_SHIP_FOR_CUSTOMER = 'free_ship_for_customer';
export const REPORT_PERIOD_FROM = 'report_period_from';
export const REPORT_PERIOD_TO = 'report_period_to';
export const STOCK_ALERT_THRESHOLD = 'stock_alert_threshold';

// Ngưỡng cảnh báo tồn kho đang cấu hình (mặc định 20 nếu chưa đặt).
export const stockAlertThreshold = (settings: AppSettings | undefined): number => {
  const value = Number(settings?.[STOCK_ALERT_THRESHOLD]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 20;
};

// Đơn không gán người giao được coi là đơn miễn ship: không phát sinh tiền công giao hàng cho ai.
// Tắt (mặc định) thì bắt buộc chọn người giao khi lưu đơn.
export const freeShipWithoutShipper = (settings: AppSettings | undefined): boolean =>
  settings?.[FREE_SHIP_WITHOUT_SHIPPER] === '1';

// Miễn ship cho khách: khách chỉ trả tiền hàng, phí ship vẫn tính công giao hàng cho nhân viên.
export const freeShipForCustomer = (settings: AppSettings | undefined): boolean =>
  settings?.[FREE_SHIP_FOR_CUSTOMER] === '1';
