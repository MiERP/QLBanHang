#!/usr/bin/env bash
# Triển khai QAROMI ERP lên VPS (chạy với quyền root).
# Cách dùng: sudo bash deploy/deploy.sh
set -euo pipefail

APP_DIR="/opt/qaromi-erp"
RUN_USER="qaromi"
SERVICE="qaromi-erp"

echo ">> Cập nhật mã nguồn (git pull)..."
sudo -u "$RUN_USER" git -C "$APP_DIR" pull --ff-only

echo ">> Cài dependencies (npm ci)..."
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && npm ci"

echo ">> Build API + Web..."
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && npm run build"

echo ">> Khởi động lại service..."
systemctl restart "$SERVICE"

echo ">> Kiểm tra health..."
sleep 2
curl -fsS http://127.0.0.1:4325/api/health && echo
systemctl --no-pager --lines=20 status "$SERVICE"

echo ">> Hoàn tất."
