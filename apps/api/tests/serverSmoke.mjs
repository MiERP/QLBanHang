// Kiểm tra bản ĐÃ BUILD chạy thật: khởi động API từ dist với CSDL tạm, gọi các endpoint chính
// và kiểm tra trang chủ SPA. Dùng cho CI và cho bước kiểm thử trong deploy.sh.
// Chạy: node apps/api/tests/serverSmoke.mjs  (sau khi đã npm run build)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.SMOKE_PORT || 4931);
const dir = mkdtempSync(join(tmpdir(), 'qaromi-smoke-'));
const dbPath = join(dir, 'smoke.db');

const server = spawn(process.execPath, ['apps/api/dist/server.js'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DB_PATH: dbPath },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (chunk) => (log += chunk));
server.stderr.on('data', (chunk) => (log += chunk));

const base = `http://127.0.0.1:${PORT}`;
const api = `${base}/api`;

async function waitUntilReady() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${api}/health`)).ok) return true;
    } catch {
      // server chưa lên
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

let failed = 0;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${label} — ${error instanceof Error ? error.message : String(error)}`);
  }
};

try {
  if (!(await waitUntilReady())) throw new Error(`API không khởi động được sau 30s:\n${log}`);

  console.log('\nEndpoint chính:');
  const endpoints = [
    '/health',
    '/settings',
    '/report-period',
    '/dashboard',
    '/notifications',
    '/orders',
    '/products',
    '/customers',
    '/customers/receivables',
    '/staff',
    '/inventory/stock',
    '/inventory/alerts',
    '/stock-tickets',
    '/finance/revenue',
    '/deposits',
    '/invoices',
    '/invoices/orders',
    '/shell-stock',
    '/targets',
    '/reports/revenue',
    '/reports/revenue-detail',
    '/reports/trade-template',
    '/reports/shell-deposits',
    '/reports/shell-audit',
    '/reports/cash-audit',
    '/loans',
    '/audit-logs',
  ];
  for (const path of endpoints) {
    await check(`GET /api${path}`, async () => {
      const res = await fetch(api + path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('json')) throw new Error(`không phải JSON: ${type}`);
    });
  }

  console.log('\nTệp Excel xuất ra:');
  for (const path of ['/inventory/stock.xlsx', '/invoices/orders.xlsx?invoice_status=INVOICED', '/customers/receivables.xlsx', '/system/export.xlsx']) {
    await check(`GET /api${path}`, async () => {
      const res = await fetch(api + path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.subarray(0, 2).toString() !== 'PK') throw new Error('không phải tệp xlsx');
      if (buffer.length < 1000) throw new Error(`tệp quá nhỏ (${buffer.length} bytes)`);
    });
  }

  console.log('\nỨng dụng web (bản build tĩnh):');
  await check('GET / trả về trang SPA', async () => {
    const res = await fetch(base + '/');
    const html = await res.text();
    if (!res.ok || !html.includes('<div id="root"')) throw new Error(`HTTP ${res.status}, không thấy #root`);
  });

  console.log('\nCSDL mới tạo:');
  await check('tự nạp dữ liệu mẫu', async () => {
    const orders = await (await fetch(`${api}/orders`)).json();
    if (!Array.isArray(orders) || orders.length === 0) throw new Error('không có đơn mẫu');
  });
  await check('sổ bút toán kho khớp bảng tồn (đối soát kho lệch = 0)', async () => {
    const audit = await (await fetch(`${api}/reports/stock-audit?warehouse_id=1`)).json();
    const diff = (audit.rows ?? []).reduce((sum, row) => sum + Math.abs(Number(row.diff || 0)), 0);
    if (diff !== 0) throw new Error(`lệch ${diff}`);
  });
  await check('doanh thu trong kỳ cấu hình lớn hơn 0', async () => {
    const revenue = await (await fetch(`${api}/reports/revenue`)).json();
    if (!(Number(revenue.summary?.totalRevenue) > 0)) throw new Error(`doanh thu = ${revenue.summary?.totalRevenue}`);
  });
} finally {
  // Đợi tiến trình thoát hẳn rồi mới xoá CSDL tạm (Windows giữ file tới lúc tiến trình đóng).
  await new Promise((resolve) => {
    if (server.exitCode !== null || server.signalCode !== null) return resolve();
    server.once('exit', resolve);
    server.kill();
    setTimeout(resolve, 5000);
  });
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Không xoá được thư mục tạm cũng không ảnh hưởng kết quả kiểm tra.
  }
}

if (failed) {
  console.error(`\nSmoke test THẤT BẠI: ${failed} mục lỗi.`);
  process.exit(1);
}
console.log('\nSmoke test bản build: OK');
