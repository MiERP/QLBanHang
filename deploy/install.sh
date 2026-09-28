#!/usr/bin/env bash
# ============================================================
#  Cài đặt QAROMI ERP lên VPS Ubuntu 24.04 (chạy với quyền root)
#  - Idempotent: có thể chạy lại nhiều lần an toàn.
#  - Chạy qua SSH:  ssh root@IP "bash /tmp/install.sh"
# ============================================================
set -euo pipefail

# ---------- Cấu hình (sửa ở đây nếu cần) ----------
GITHUB_REPO="https://github.com/MiERP/QLBanHang.git"
BRANCH="14-09-2026"
APP_DIR="/opt/qaromi-erp"
RUN_USER="qaromi"
NODE_PORT=4325          # port nội bộ Node (không cần đổi)
PUBLIC_PORT=8080        # port người dùng truy cập từ trình duyệt
DB_PATH="$APP_DIR/data/qaromi_erp.db"
# ---------------------------------------------------

export DEBIAN_FRONTEND=noninteractive

log()  { printf '\n\033[1;32m[+] %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m[!] %s\033[0m\n' "$*"; }
err()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; }

[[ $EUID -eq 0 ]] || { err "Phải chạy với quyền root."; exit 1; }

log "1/9 Cài gói hệ thống..."
apt-get update -y
apt-get install -y git curl nginx build-essential python3 sqlite3 ca-certificates gnupg

log "2/9 Tạo swap 2GB (nếu chưa có)..."
if ! swapon --show 2>/dev/null | grep -q swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  -> Đã tạo swap 2GB"
else
  echo "  -> Swap đã có, bỏ qua"
fi

log "3/9 Cài Node.js 22 LTS (nếu chưa có)..."
if ! command -v node >/dev/null 2>&1 || ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "  -> $(node -v), $(npm -v)"

log "4/9 Tạo user '$RUN_USER' và thư mục app..."
id -u "$RUN_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$RUN_USER"
mkdir -p "$APP_DIR/data" "$APP_DIR/backups"
chown -R "$RUN_USER:$RUN_USER" "$APP_DIR"

log "5/9 Lấy mã nguồn (nhánh $BRANCH)..."
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u "$RUN_USER" git clone "$GITHUB_REPO" "$APP_DIR"
else
  sudo -u "$RUN_USER" git -C "$APP_DIR" fetch origin
fi
sudo -u "$RUN_USER" git -C "$APP_DIR" checkout "$BRANCH"
sudo -u "$RUN_USER" git -C "$APP_DIR" pull --ff-only "origin" "$BRANCH"

log "6/9 Cài dependencies + build (lâu nhất, 2-5 phút)..."
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && npm ci && npm run build"

log "7/9 Cài service systemd..."
cp "$APP_DIR/deploy/qaromi-erp.service" /etc/systemd/system/qaromi-erp.service
sed -i "s/^Environment=PORT=.*/Environment=PORT=$NODE_PORT/" /etc/systemd/system/qaromi-erp.service
sed -i "s|^Environment=DB_PATH=.*|Environment=DB_PATH=$DB_PATH|" /etc/systemd/system/qaromi-erp.service
systemctl daemon-reload
systemctl enable --now qaromi-erp

log "8/9 Cài Nginx reverse proxy (port $PUBLIC_PORT)..."
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/qaromi-erp
sed -i "s/listen 8080;/listen $PUBLIC_PORT;/" /etc/nginx/sites-available/qaromi-erp
sed -i "s/listen \[::\]:8080;/listen [::]:$PUBLIC_PORT;/" /etc/nginx/sites-available/qaromi-erp
ln -sf /etc/nginx/sites-available/qaromi-erp /etc/nginx/sites-enabled/qaromi-erp
nginx -t
systemctl reload nginx

log "9/9 Mở firewall (OpenSSH + $PUBLIC_PORT)..."
warn "Đảm bảo SSH đang dùng port 22 (mặc định). Nếu đổi port SSH khác, hãy mở port đó trước khi enable ufw."
command -v ufw >/dev/null 2>&1 && {
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow "$PUBLIC_PORT/tcp" >/dev/null 2>&1 || true
  ufw --force enable || true
}

sleep 2
log "Kiểm tra health..."
curl -fsS "http://127.0.0.1:$NODE_PORT/api/health" && echo || warn "Health check chưa trả về — xem log bên dưới."
systemctl --no-pager --lines=15 status qaromi-erp || true

log "HOÀN TẤT. Truy cập: http://<IP_VPS>:$PUBLIC_PORT"
