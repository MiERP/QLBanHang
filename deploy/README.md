# Triển khai QAROMI ERP lên VPS (Ubuntu 24.04)

Cấu hình cho VPS: **2 CPU / 2GB RAM / 30GB NVMe / IP 103.20.102.229**.

Kiến trúc: 1 process Node (Express) vừa chạy REST API `/api/*` vừa serve frontend tĩnh
(build từ `apps/web`). Dữ liệu là **SQLite 1 file** (`qaromi_erp.db`), module native
`better-sqlite3`. Server bind `127.0.0.1:4325`, Nginx reverse proxy ra ngoài.

---

## 0. Chuẩn bị hệ thống (chạy 1 lần, với user root)

```bash
# Cập nhật + cài công cụ cơ bản
apt update && apt upgrade -y
apt install -y git curl nginx build-essential python3 ca-certificates gnupg

# Tạo 2GB swap (cần cho VPS 2GB RAM khi build frontend)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# Tường lửa: mở SSH + port của ERP (8080). Port 80/443 để app kia dùng.
ufw allow OpenSSH
ufw allow 8080/tcp
ufw --force enable
```

### Cài Node.js 22 LTS (khuyến nghị — Vite 8 cần Node ≥ 20.19, better-sqlite3 có sẵn prebuild cho Node 22)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # phải ra v22.x
```

> Nếu `better-sqlite3` phải build từ source (thiếu prebuild), cần thêm
> `python3` + `build-essential` (đã cài ở trên).

---

## 1. Tạo user và thư mục app

```bash
useradd --system --create-home --shell /bin/bash qaromi
mkdir -p /opt/qaromi-erp/data
chown -R qaromi:qaromi /opt/qaromi-erp
```

---

## 2. Lấy mã nguồn lên VPS

```bash
sudo -u qaromi git clone https://github.com/MiERP/QLBanHang.git /opt/qaromi-erp
sudo -u qaromi git -C /opt/qaromi-erp checkout 14-09-2026
```

> Nếu repo **private**, clone bằng HTTPS sẽ đòi token. Đơn giản nhất là cấu hình SSH key
> cho user `qaromi` rồi clone bằng `git@github.com:MiERP/QLBanHang.git`, hoặc dùng
> Personal Access Token trong URL: `https://<TOKEN>@github.com/MiERP/QLBanHang.git`.

---

## 3. Cài dependencies và build

```bash
sudo -u qaromi bash -c "cd /opt/qaromi-erp && npm ci && npm run build"
```

> `npm run build` = build API (tsc → `apps/api/dist`) + build Web (vite → `apps/web/dist`).
> Nếu bị OOM khi build, giảm bộ nhớ: `NODE_OPTIONS=--max-old-space-size=1024 npm run build`.

---

## 4. Cài service systemd (tự chạy, tự restart)

```bash
cp /opt/qaromi-erp/deploy/qaromi-erp.service /etc/systemd/system/qaromi-erp.service
systemctl daemon-reload
systemctl enable --now qaromi-erp
systemctl status qaromi-erp --no-pager

# Kiểm tra API trả lời
curl -fsS http://127.0.0.1:4325/api/health
```

---

## 5. Cài Nginx reverse proxy

```bash
cp /opt/qaromi-erp/deploy/nginx.conf /etc/nginx/sites-available/qaromi-erp
ln -sf /etc/nginx/sites-available/qaromi-erp /etc/nginx/sites-enabled/qaromi-erp
nginx -t && systemctl reload nginx
```

Sau đó mở trình duyệt: **http://103.20.102.229:8080**

> Nếu có tên miền, đổi `listen` về 80 + `server_name` thành domain rồi chạy
> `certbot --nginx` để có HTTPS. (Cài certbot: `apt install -y certbot python3-certbot-nginx`)

---

## 6. Di chuyển dữ liệu hiện có (nếu cần)

File `qaromi_erp.db` bị gitignore nên **không nằm trong repo**. Khi chạy lần đầu,
VPS sẽ tự tạo DB mới + seed dữ liệu danh mục. Muốn mang dữ liệu thật từ máy lên:

```bash
# Trên máy bạn (đứng tại thư mục dự án):
scp qaromi_erp.db qaromi@103.20.102.229:/opt/qaromi-erp/data/qaromi_erp.db

# Trên VPS:
chown qaromi:qaromi /opt/qaromi-erp/data/qaromi_erp.db
systemctl restart qaromi-erp
```

> Sao lưu trước khi ghi đè: `cp /opt/qaromi-erp/data/qaromi_erp.db ~/qaromi_erp.db.bak`

---

## 7. Sao lưu DB định kỳ (bắt buộc — SQLite là nơi chứa toàn bộ dữ liệu)

```bash
cat > /opt/qaromi-erp/deploy/backup.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DB=/opt/qaromi-erp/data/qaromi_erp.db
OUT=/opt/qaromi-erp/backups
mkdir -p "$OUT"
# sqlite3 phải có: apt install -y sqlite3
sqlite3 "$DB" ".backup '$OUT/qaromi_erp-$(date +%F-%H%M).db"
ls -1t "$OUT" | tail -n +15 | xargs -I{} rm -f "$OUT/{}"
EOF
chmod +x /opt/qaromi-erp/deploy/backup.sh
apt install -y sqlite3

# Chạy backup mỗi giờ
echo "0 * * * * /opt/qaromi-erp/deploy/backup.sh" | crontab -
```

---

## 8. Cập nhật code sau này (mỗi lần đẩy code mới)

```bash
# Trên máy bạn: commit + push lên GitHub (hoặc remote vps)
# Trên VPS:
sudo bash /opt/qaromi-erp/deploy/deploy.sh
```

`deploy.sh` sẽ: `git pull` → `npm ci` → `npm run build` → restart service → check health.

---

## Xem log khi có lỗi

```bash
journalctl -u qaromi-erp -f            # log app theo thời gian thực
journalctl -u qaromi-erp --since "1 hour ago"
tail -f /var/log/nginx/error.log      # log nginx
```

## Gỡ cài đặt

```bash
systemctl disable --now qaromi-erp
rm /etc/systemd/system/qaromi-erp.service
rm /etc/nginx/sites-enabled/qaromi-erp
rm -rf /opt/qaromi-erp
```
