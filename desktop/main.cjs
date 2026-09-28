const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { fork } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const port = Number(process.env.PORT ?? 4325);
const appUrl = `http://127.0.0.1:${port}`;
const appRoot = app.isPackaged ? app.getAppPath() : join(__dirname, '..');
const serverEntry = join(appRoot, 'apps', 'api', 'dist', 'server.js');
const serverRuntime = app.isPackaged ? join(process.resourcesPath, 'runtime', 'node.exe') : (process.env.npm_node_execpath ?? 'node');
const preload = join(__dirname, 'preload.cjs');
let server;
let win;

ipcMain.handle('open-in-browser', (event, url) => shell.openExternal(url || appUrl));

// Bản cài đặt để CSDL trong thư mục dữ liệu người dùng: thư mục cài đặt bị thay khi cập nhật.
function databasePath() {
  return app.isPackaged ? join(app.getPath('userData'), 'qaromi_erp.db') : undefined;
}

async function serverHealthy() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function startServer() {
  const dbPath = databasePath();
  server = fork(serverEntry, [], {
    cwd: appRoot,
    execPath: serverRuntime,
    env: { ...process.env, PORT: String(port), ...(dbPath ? { DB_PATH: dbPath } : {}) },
    stdio: 'ignore',
  });
  server.on('exit', (code) => {
    if (!app.isQuitting) console.error(`API process exited with code ${code}`);
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if (await serverHealthy()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Không thể kết nối tới máy chủ QAROMI ERP API.');
}

function stopServer() {
  if (server && !server.killed) {
    server.kill();
  }
}

function start() {
  app.whenReady().then(async () => {
    try {
      if (!existsSync(serverEntry)) {
        throw new Error(`Không tìm thấy API tại ${serverEntry}. Chạy "npm run build" trước khi mở ứng dụng.`);
      }
      if (app.isPackaged && !existsSync(serverRuntime)) {
        throw new Error(`Không tìm thấy runtime node tại ${serverRuntime}.`);
      }
      if (!(await serverHealthy())) {
        startServer();
      }
      await waitForServer();

      win = new BrowserWindow({
        width: 1480,
        height: 920,
        minWidth: 1200,
        minHeight: 760,
        title: 'QAROMI ERP - Xí Nghiệp Nước Hồng Gai (QUAWANCO)',
        icon: join(appRoot, 'desktop', 'build', 'icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
          preload,
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      await win.loadURL(appUrl);
    } catch (error) {
      dialog.showErrorBox('Lỗi khởi động QAROMI ERP', error instanceof Error ? error.message : 'Lỗi không xác định.');
      app.quit();
    }
  });
}

// Một máy chỉ mở một cửa sổ: lần mở sau đưa cửa sổ đang chạy lên trước.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  start();
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopServer();
});
