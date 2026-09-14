/**
 * Chụp ảnh các màn hình demo bằng Electron.
 * Chạy:  node_modules\.bin\electron demo\screenshot.cjs
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:4390';
const OUT = path.join(__dirname, 'screenshots');

const wait = ms => new Promise(r => setTimeout(r, ms));
async function health() { try { const r = await fetch(BASE + '/api/health'); return r.ok; } catch (e) { return false; } }
async function waitHealth(ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await health()) return true; await wait(600); } return false; }

let server = null;
async function ensureServer() {
  if (await health()) { console.log('Server đã chạy sẵn.'); return; }
  console.log('Khởi động server demo...');
  server = spawn('node', ['demo/server.cjs'], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', () => {});
  server.stderr.on('data', d => process.stderr.write(d));
  if (!await waitHealth(45000)) throw new Error('Server không khởi động được');
  console.log('Server sẵn sàng.');
}

const SHOTS = [
  { name: '01-bang-dieu-khien', hash: '#overview' },
  { name: '02-viec-can-xu-ly', hash: '#worklist' },
  { name: '03-san-pham-bang-gia', hash: '#products' },
  { name: '04-tien-theo-nhan-vien', hash: '#cash' },
  { name: '05-phi-van-chuyen', hash: '#delivery' },
  { name: '06-doanh-thu-chi-tieu', hash: '#kpi' },
  { name: '07-cong-no-tien', hash: '#custdebt' },
  { name: '08-so-no-vo', hash: '#shells' },
  { name: '09-co-hoi-cham-soc', hash: '#crm' },
  { name: '10-don-ban', hash: '#orders' },
  { name: '11-tao-bao-gia', hash: '#orders', action: `document.getElementById('btn-neworder').click()` },
  { name: '12-chi-tiet-don', hash: '#orders', action: `document.querySelector('[data-order]').click()` },
  { name: '13-dich-vu-gia-tang', hash: '#dvgt' },
  { name: '14-phieu-kho', hash: '#pickings' },
  { name: '15-chi-tiet-phieu', hash: '#pickings', action: `document.querySelector('[data-pick]').click()` },
  { name: '16-ton-kho', hash: '#quants' },
  { name: '17-dong-dich-chuyen', hash: '#moves' },
  { name: '18-vi-tri-tuyen-duong', hash: '#config' },
  { name: '19-ban-do-quan-he', hash: '#relations' },
];

(async () => {
  await app.whenReady();
  await ensureServer();
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const win = new BrowserWindow({
    width: 1500, height: 980, show: false,
    webPreferences: { backgroundThrottling: false, offscreen: false },
  });
  win.webContents.on('did-fail-load', (e, code, desc, url) => console.error('Lỗi tải:', desc, url));

  for (const shot of SHOTS) {
    try {
      await win.loadURL(BASE + '/' + shot.hash);
      await wait(1600);
      if (shot.action) { await win.webContents.executeJavaScript(shot.action); await wait(1200); }
      const img = await win.webContents.capturePage();
      const file = path.join(OUT, shot.name + '.png');
      fs.writeFileSync(file, img.toPNG());
      const s = img.getSize();
      console.log(`  ✔ ${shot.name}.png (${s.width}×${s.height})`);
    } catch (e) {
      console.error(`  ✘ ${shot.name}: ${e.message}`);
    }
  }

  win.destroy();
  if (server) server.kill();
  console.log('\nXong. Ảnh lưu tại: demo/screenshots/');
  app.quit();
})().catch(e => { console.error(e); if (server) server.kill(); app.quit(); process.exit(1); });
