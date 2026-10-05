#!/usr/bin/env bash
# Triển khai QAROMI ERP lên VPS (chạy với quyền root).
# Cách dùng: sudo bash deploy/deploy.sh
#
# Thứ tự an toàn cho go-live:
#   1. Sao lưu CSDL hiện tại
#   2. Kéo mã nguồn mới
#   3. Cài dependencies + build
#   4. Chạy TOÀN BỘ test nghiệp vụ + smoke test bản build
#   5. Chỉ khi mọi bước trên đạt mới khởi động lại service
# Nếu bước 2-4 lỗi, script dừng ngay (set -e) và service cũ vẫn đang chạy bình thường.
set -euo pipefail

APP_DIR="/opt/qaromi-erp"
RUN_USER="qaromi"
SERVICE="qaromi-erp"
DB_PATH="/opt/qaromi-erp/data/qaromi_erp.db"
BACKUP_DIR="/opt/qaromi-erp/backups"
KEEP_BACKUPS=15

echo ">> [1/6] Sao lưu CSDL trước khi cập nhật..."
BACKUP_FILE=""
if [[ -f "$DB_PATH" ]]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/qaromi_erp-$(date +%F-%H%M%S).db"
  cp "$DB_PATH" "$BACKUP_FILE"
  # Giữ 15 bản gần nhất (không để lỗi dọn dẹp làm dừng triển khai)
  ls -1t "$BACKUP_DIR"/qaromi_erp-*.db 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f || true
  echo "   -> $BACKUP_FILE"
else
  echo "   -> Chưa có CSDL, bỏ qua"
fi

echo ">> [2/6] Cập nhật mã nguồn (git pull)..."
sudo -u "$RUN_USER" git -C "$APP_DIR" pull --ff-only
echo "   -> Đang ở commit: $(sudo -u "$RUN_USER" git -C "$APP_DIR" rev-parse --short HEAD)"

echo ">> [3/6] Cài dependencies (npm ci)..."
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && npm ci --include=dev"

echo ">> [4/6] Build API + Web..."
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && npm run build"

echo ">> [5/6] Kiểm thử trước khi phát hành (test nghiệp vụ + smoke bản build)..."
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && npm test"
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && npm run smoke"

echo ">> [6/6] Khởi động lại service..."
systemctl restart "$SERVICE"

echo ">> Kiểm tra health..."
sleep 2
if ! curl -fsS http://127.0.0.1:4325/api/health >/dev/null; then
  echo "!! Service không trả lời health check. Xem log: journalctl -u $SERVICE -n 100"
  if [[ -n "$BACKUP_FILE" ]]; then
    echo "!! CSDL trước khi cập nhật nằm ở: $BACKUP_FILE"
    echo "!! Khôi phục: systemctl stop $SERVICE && cp '$BACKUP_FILE' '$DB_PATH' && systemctl start $SERVICE"
  fi
  exit 1
fi
curl -fsS http://127.0.0.1:4325/api/health && echo
systemctl --no-pager --lines=15 status "$SERVICE" || true

echo ">> HOÀN TẤT."
