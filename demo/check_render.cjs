const { app, BrowserWindow } = require('electron');
const path = require('path');
const BASE = 'http://127.0.0.1:4390';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await app.whenReady();
  const win = new BrowserWindow({ width: 1500, height: 980, show: false, webPreferences: { backgroundThrottling: false } });
  const routes = ['#overview', '#worklist', '#products', '#cash', '#delivery', '#kpi', '#custdebt', '#shells', '#crm', '#orders', '#dvgt', '#pickings', '#quants', '#moves', '#config', '#relations'];
  for (const h of routes) {
    await win.loadURL(BASE + '/' + h);
    await wait(1500);
    const info = await win.webContents.executeJavaScript(`(() => {
      const v = document.getElementById('view');
      const t = (v ? v.innerText : '').replace(/\\s+/g,' ').trim();
      return { len: t.length, err: /Không kết nối|Lỗi:|Lỗi tải/.test(t), head: t.slice(0, 110) };
    })()`);
    console.log(`${info.err ? 'FAIL' : 'OK  '} ${h.padEnd(12)} len=${String(info.len).padEnd(6)} ${info.head}`);
  }
  win.destroy(); app.quit();
})().catch(e => { console.error(e); app.quit(); });
