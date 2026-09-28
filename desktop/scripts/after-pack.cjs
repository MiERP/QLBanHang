const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

// Chốt chặn sau khi đóng gói: mọi thứ dưới đây từng là lỗi chỉ lộ ra khi người dùng
// mở app trên máy khác, nên phải làm build đổ ngay tại đây.
const REQUIRED = [
  'runtime/node.exe',
  'app/desktop/main.cjs',
  'app/desktop/build/icon.png',
  'app/apps/api/dist/server.js',
  'app/apps/api/src/schema.sql',
  'app/apps/api/src/seed.sql',
  'app/apps/web/dist/index.html',
  'app/node_modules/express',
  'app/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
];

// Chỉ dùng lúc build, lọt vào gói là phình thêm hàng trăm MB.
const BUILD_ONLY = ['vite', 'typescript', 'tsx', 'electron', 'electron-builder', 'concurrently'];

module.exports = async function afterPack(context) {
  const resources = join(context.appOutDir, 'resources');
  const binary = context.electronPlatformName === 'win32' ? 'node.exe' : 'node';

  if (existsSync(join(resources, 'app.asar'))) {
    throw new Error('[after-pack] Gói đang ở dạng app.asar nhưng API chạy bằng node.exe nên không đọc được — kiểm tra `asar: false` trong electron-builder.yml.');
  }

  const missing = REQUIRED.map((p) => p.replace('runtime/node.exe', `runtime/${binary}`)).filter(
    (p) => !existsSync(join(resources, p))
  );
  if (missing.length) {
    throw new Error(`[after-pack] Bộ cài thiếu: ${missing.join(', ')}`);
  }

  const leaked = BUILD_ONLY.filter((p) => existsSync(join(resources, 'app', 'node_modules', p)));
  if (leaked.length) {
    throw new Error(`[after-pack] Bộ cài lẫn dependency chỉ dùng lúc build: ${leaked.join(', ')} — kiểm tra mục "files" trong electron-builder.yml.`);
  }

  if (existsSync(join(resources, 'app', 'qaromi_erp.db'))) {
    throw new Error('[after-pack] CSDL nằm trong thư mục cài đặt — dữ liệu sẽ mất khi cập nhật. CSDL phải do userData quản lý.');
  }

  // Native module phải nạp được bằng đúng runtime đi kèm; lệch ABI (do electron-builder
  // rebuild theo Electron) là lỗi chết app ngay khi mở. better-sqlite3 chỉ nạp addon khi
  // khởi tạo Database nên phải mở thật một CSDL trong bộ nhớ, không chỉ require().
  const probe = "new (require('better-sqlite3'))(':memory:').prepare('select 1 as n').get()";
  try {
    execFileSync(join(resources, 'runtime', binary), ['-e', probe], {
      cwd: join(resources, 'app'),
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(`[after-pack] ${binary} đi kèm không nạp được better-sqlite3 (lệch ABI) — kiểm tra \`npmRebuild: false\` trong electron-builder.yml.\n${error.message}`);
  }

  console.log(`[after-pack] OK: ${binary} + API + web + better-sqlite3 hợp lệ, không lẫn CSDL/devDependencies.`);
};
