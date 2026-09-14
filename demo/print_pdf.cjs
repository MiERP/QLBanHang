const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const REPO = path.join(__dirname, '..');
const HTML = path.join(REPO, 'docs/DE_XUAT_GIAI_PHAP_VA_DAU_TU.html');
const PDF = path.join(REPO, 'docs/DE_XUAT_GIAI_PHAP_VA_DAU_TU.pdf');

(async () => {
  await app.whenReady();
  const win = new BrowserWindow({ width: 1240, height: 1754, show: false, webPreferences: { offscreen: false } });
  await win.loadFile(HTML);
  await new Promise(r => setTimeout(r, 2500));
  const data = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.45, right: 0.45 },
    preferCSSPageSize: false,
  });
  fs.writeFileSync(PDF, data);
  console.log('ĐÃ TẠO: ' + PDF);
  console.log('Kích thước: ' + (fs.statSync(PDF).size / 1024 / 1024).toFixed(2) + ' MB');
  win.destroy();
  app.quit();
})().catch(e => { console.error(e); app.quit(); process.exit(1); });
