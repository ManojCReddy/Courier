const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

app.setName('Courier');
app.setAppUserModelId('com.courier.app');
app.setPath('userData', path.join(app.getPath('appData'), 'Courier'));
app.setPath('sessionData', path.join(app.getPath('appData'), 'Courier', 'Sessions'));

const appIcon = path.join(__dirname, '..', 'assets', 'courier-icon.ico');

let mainWindow;
let backendProcess;

async function waitForBackend() {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch('http://localhost:4174/api/health');
      if (response.ok) return;
    } catch (error) {
      // wait and retry until the backend is ready
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error('Courier backend did not start on localhost:4174');
}

async function startBackend() {
  try {
    const response = await fetch('http://localhost:4174/api/health');
    if (response.ok) {
      return;
    }
  } catch (error) {
    // No backend is currently running; start the local Courier server.
  }

  const rootDir = app.getAppPath();
  const serverScript = path.join(rootDir, 'server', 'index.js');

  if (!fs.existsSync(serverScript)) {
    console.error(`Courier backend not found at ${serverScript}`);
    throw new Error(`Courier backend not found at ${serverScript}`);
  }

  await import(pathToFileURL(serverScript).href);
  await waitForBackend();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0c0c0e',
    title: 'Courier - Local-First API Workbench & Test Suite',
    icon: appIcon,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setIcon(appIcon);

  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  mainWindow.loadURL('http://localhost:4174');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  try {
    await startBackend();
  } catch (error) {
    console.error('Courier backend startup failed:', error);
    app.exit(1);
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
