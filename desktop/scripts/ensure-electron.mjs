import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Lệnh desktop cần Electron runtime đã tải (postinstall của electron có thể bị bỏ qua
// khi npm chạy với NODE_ENV=production). Tự tải lại thay vì để lệnh build lỗi khó hiểu.
const require = createRequire(import.meta.url);

let electronDir;
try {
  electronDir = join(require.resolve('electron/package.json'), '..');
} catch {
  console.error('[desktop] Chưa cài devDependencies (thiếu gói electron).');
  console.error('[desktop] Chạy:  npm install --include=dev');
  process.exit(1);
}

function runtimePath() {
  const pathFile = join(electronDir, 'path.txt');
  if (!existsSync(pathFile)) return null;
  const binary = join(electronDir, 'dist', readFileSync(pathFile, 'utf-8').trim());
  return existsSync(binary) ? binary : null;
}

if (!runtimePath()) {
  console.log('[desktop] Chưa có Electron runtime, đang tải về (một lần)...');
  execFileSync(process.execPath, [join(electronDir, 'install.js')], { stdio: 'inherit' });
}

const binary = runtimePath();
if (!binary) {
  console.error('[desktop] Tải Electron runtime thất bại. Kiểm tra mạng rồi chạy lại.');
  process.exit(1);
}

console.log(`[desktop] Electron runtime: ${binary}`);
