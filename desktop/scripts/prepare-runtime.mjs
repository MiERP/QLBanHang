import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Bộ cài chạy API bằng tiến trình node riêng (không phải Electron), nên phải mang theo
// đúng bản node đang build: native module better-sqlite3 giữ nguyên ABI của node này.
const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));
const runtimeDir = join(desktopDir, 'runtime');
const binaryName = process.platform === 'win32' ? 'node.exe' : 'node';
const source = process.execPath;
const target = join(runtimeDir, binaryName);

mkdirSync(runtimeDir, { recursive: true });
copyFileSync(source, target);

const size = statSync(target).size;
console.log(`[desktop] Runtime node ${process.version} -> ${target} (${(size / 1024 / 1024).toFixed(1)} MB)`);
