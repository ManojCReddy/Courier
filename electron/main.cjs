const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

app.setName('Courier');
app.setAppUserModelId('com.courier.app');
app.setPath('userData', path.join(app.getPath('appData'), 'Courier'));
app.setPath('sessionData', path.join(app.getPath('appData'), 'Courier', 'Sessions'));

// ─── Startup perf: disable GPU sandbox & enable V8 code caching ───
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const appIcon = path.join(__dirname, '..', 'assets', 'courier-icon.ico');

let mainWindow = null;
let splashWindow = null;

// ─── Splash window: appears in ~100ms while Chromium + backend load ───
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    icon: appIcon,
    backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  // Inline HTML splash — no file I/O, renders instantly
  const splashHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:320px; height:320px;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    background: transparent;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    -webkit-app-region: no-drag;
    overflow: hidden;
  }
  .tile {
    width:200px; height:200px;
    border-radius:44px;
    background: linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%);
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 24px 64px rgba(5,150,105,0.45), 0 8px 24px rgba(0,0,0,0.6);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .tile img { width:140px; height:140px; border-radius:28px; }
  .label {
    margin-top:18px;
    font-size:15px;
    font-weight:700;
    letter-spacing:0.2em;
    color:rgba(255,255,255,0.85);
    text-transform:uppercase;
  }
  .sub {
    margin-top:5px;
    font-size:11px;
    color:rgba(255,255,255,0.35);
    letter-spacing:0.05em;
  }
  .dots {
    display:flex; gap:6px; margin-top:16px;
  }
  .dot {
    width:6px; height:6px; border-radius:50%;
    background:#34d399;
    animation: bounce 1.2s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay:0.2s; }
  .dot:nth-child(3) { animation-delay:0.4s; }
  @keyframes pulse {
    0%,100% { box-shadow: 0 24px 64px rgba(5,150,105,0.45), 0 8px 24px rgba(0,0,0,0.6); }
    50%      { box-shadow: 0 24px 80px rgba(5,150,105,0.65), 0 8px 32px rgba(0,0,0,0.7); }
  }
  @keyframes bounce {
    0%,100% { transform:translateY(0); opacity:0.4; }
    50%      { transform:translateY(-5px); opacity:1; }
  }
</style>
</head>
<body>
  <div class="tile">
    <svg width="120" height="120" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="e" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#022c1e"/>
          <stop offset="100%" stop-color="#041a2e"/>
        </linearGradient>
        <linearGradient id="b" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d1fae5"/>
          <stop offset="100%" stop-color="#a5f3fc"/>
        </linearGradient>
        <linearGradient id="ao" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="50%" stop-color="#ecfdf5" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
        <linearGradient id="ai" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#cffafe" stop-opacity="0"/>
          <stop offset="50%" stop-color="#67e8f9" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#a5f3fc"/>
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="220" stroke="#ffffff" stroke-width="1" stroke-opacity="0.12" fill="none"/>
      <path d="M 115 332 A 165 165 0 1 1 408 196" fill="none" stroke="url(#ao)" stroke-width="12" stroke-linecap="round"/>
      <path d="M 408 196 A 165 165 0 0 1 115 332" fill="none" stroke="url(#ai)" stroke-width="8" stroke-linecap="round" stroke-dasharray="26 16"/>
      <circle cx="408" cy="196" r="14" fill="#ffffff" opacity="0.95"/>
      <circle cx="408" cy="196" r="7" fill="#d1fae5"/>
      <circle cx="115" cy="332" r="11" fill="#a5f3fc" opacity="0.9"/>
      <polygon points="406,172 424,196 400,205" fill="#ffffff" opacity="0.9"/>
      <g transform="translate(256,262) rotate(-3)">
        <rect x="-96" y="-68" width="192" height="136" rx="12" fill="url(#e)" stroke="url(#b)" stroke-width="5"/>
        <path d="M -96 -68 L 0 18 L 96 -68 Z" fill="#022c1e" stroke="url(#b)" stroke-width="4" stroke-linejoin="round"/>
        <line x1="-96" y1="68" x2="-30" y2="12" stroke="#1a4a30" stroke-width="2.5" opacity="0.5"/>
        <line x1=" 96" y1="68" x2=" 30" y2="12" stroke="#164e6e" stroke-width="2.5" opacity="0.5"/>
        <circle cx="0" cy="22" r="25" fill="#071812" stroke="#34d399" stroke-width="3"/>
        <path d="M -13 14 L -21 22 L -13 30" fill="none" stroke="#6ee7b7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="3" y1="13" x2="-3" y2="31" stroke="#a5f3fc" stroke-width="4" stroke-linecap="round"/>
        <path d="M 13 14 L 21 22 L 13 30" fill="none" stroke="#67e8f9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>
  </div>
  <div class="label">Courier</div>
  <div class="sub">Local-First API Workbench</div>
  <div class="dots">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
</body>
</html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

// ─── Main window (hidden until ready-to-show fires) ───
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
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setIcon(appIcon);

  ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });

  mainWindow.loadURL('http://localhost:4174');

  // Once the main window is ready, close splash and show app
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Backend: health-check + start (unchanged logic) ───
async function waitForBackend() {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:4174/api/health');
      if (response.ok) return;
    } catch (_) { /* retry */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Courier backend did not start on localhost:4174');
}

async function startBackend() {
  try {
    const response = await fetch('http://localhost:4174/api/health');
    if (response.ok) return; // already running
  } catch (_) { /* start it */ }

  const rootDir = app.getAppPath();
  const serverScript = path.join(rootDir, 'server', 'index.js');

  if (!fs.existsSync(serverScript)) {
    throw new Error(`Courier backend not found at ${serverScript}`);
  }

  await import(pathToFileURL(serverScript).href);
  await waitForBackend();
}

// ─── Boot sequence: splash + backend + window all kick off ASAP ───
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Show splash immediately — user sees something in <200ms
  createSplash();

  // Start backend & create window in parallel
  try {
    await startBackend();
  } catch (error) {
    console.error('Courier backend startup failed:', error);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    app.exit(1);
    return;
  }

  // Backend is ready — create main window (Chromium loads from backend)
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
