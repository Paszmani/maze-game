/**
 * Processo principal do Electron — a casca de producao do totem (modulo 9).
 *
 * Faz o que o navegador puro nao faz bem: janela kiosk em tela cheia com lockdown
 * (visitante nao escapa pro Windows) e gravacao de lead em disco via `fs`
 * (1 JSON por lead + CSV consolidado, regenerado a cada gravacao p/ unir colunas).
 *
 * Layout de pastas esperado (ao lado do .exe em producao):
 *   KioskMaze.exe
 *   config.json        -> { "themeId": "...", "terminalId": "..." }
 *   themes/<id>/...     -> temas externos (opcional; fallback ao bundle)
 *   data/leads/         -> SAIDA: leads.csv + raw/<...>.json
 *
 * Saida de admin: Ctrl+Shift+Q.
 */

const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_ROOT = path.join(__dirname, '..');
const DEV_URL = process.env.KIOSK_DEV_URL;

let allowQuit = false;

// --- Caminhos de disco -----------------------------------------------------

function baseDir() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : APP_ROOT;
}

function firstExisting(candidates, fallback) {
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignora */
    }
  }
  return fallback;
}

function themesRoot() {
  return firstExisting(
    [
      path.join(baseDir(), 'themes'),
      path.join(APP_ROOT, 'dist', 'themes'),
      path.join(APP_ROOT, 'public', 'themes'),
    ],
    path.join(APP_ROOT, 'dist', 'themes'),
  );
}

function leadsDir() {
  return path.join(baseDir(), 'data', 'leads');
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(baseDir(), 'config.json'), 'utf8'));
  } catch {
    return {};
  }
}

// --- Tema: le do disco e embute sprites como data-URI ----------------------

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

function toDataUri(dir, rel) {
  try {
    const file = path.join(dir, rel);
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return rel; // deixa como esta; o resolver/loader tem fallback
  }
}

function inlineField(obj, key, dir) {
  const v = obj && obj[key];
  if (typeof v === 'string' && v && !/^(data:|https?:)/.test(v)) obj[key] = toDataUri(dir, v);
}

function inlineSprites(raw, dir) {
  if (raw.branding) inlineField(raw.branding, 'logo', dir);
  const s = raw.sprites;
  if (!s) return;
  for (const k of ['player', 'pellet', 'powerPellet', 'frightened', 'mazeBackground', 'attractBackground']) {
    inlineField(s, k, dir);
  }
  if (Array.isArray(s.ghosts)) {
    s.ghosts = s.ghosts.map((g) => (typeof g === 'string' && g && !/^(data:|https?:)/.test(g) ? toDataUri(dir, g) : g));
  } else if (s.ghosts && typeof s.ghosts === 'object') {
    for (const k of Object.keys(s.ghosts)) inlineField(s.ghosts, k, dir);
  }
}

// --- CSV consolidado (uniao de colunas) ------------------------------------

function leadsToCsv(leads) {
  const meta = ['timestamp', 'terminalId', 'themeId', 'score'];
  const ids = [];
  for (const l of leads) for (const k of Object.keys(l.fields || {})) if (!ids.includes(k)) ids.push(k);
  const cell = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const header = [...meta, ...ids];
  const rows = leads.map((l) => [
    l.timestamp,
    l.terminalId,
    l.themeId,
    String(l.score),
    ...ids.map((id) => (l.fields && l.fields[id]) || ''),
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

function regenerateCsv(dir) {
  const rawDir = path.join(dir, 'raw');
  const files = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter((f) => f.endsWith('.json')) : [];
  const leads = files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  fs.writeFileSync(path.join(dir, 'leads.csv'), leadsToCsv(leads), 'utf8');
}

// --- IPC -------------------------------------------------------------------

function registerIpc() {
  ipcMain.handle('kiosk:getConfig', () => {
    const cfg = readConfig();
    return { terminalId: cfg.terminalId || 'totem-01', themeId: cfg.themeId || 'gsb-default' };
  });

  ipcMain.handle('kiosk:loadTheme', () => {
    const id = readConfig().themeId || 'gsb-default';
    const dir = path.join(themesRoot(), id);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'));
    } catch {
      return {};
    }
    inlineSprites(raw, dir);
    return raw;
  });

  ipcMain.handle('kiosk:saveLead', (_event, lead) => {
    const dir = leadsDir();
    fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
    const stamp = String(lead.timestamp || new Date().toISOString()).replace(/[:.]/g, '-');
    const name = `${stamp}-${lead.terminalId || 'totem'}.json`;
    fs.writeFileSync(path.join(dir, 'raw', name), JSON.stringify(lead, null, 2), 'utf8');
    regenerateCsv(dir);
  });

  ipcMain.handle('kiosk:revealLeads', () => {
    const dir = leadsDir();
    fs.mkdirSync(dir, { recursive: true });
    return shell.openPath(dir);
  });
}

// --- Janela e lockdown -----------------------------------------------------

function createWindow() {
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#000010',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Bloqueia atalhos de fuga; Ctrl+Shift+Q sai (admin).
  win.webContents.on('before-input-event', (event, input) => {
    const key = (input.key || '').toLowerCase();
    const mod = input.control || input.meta;
    if (mod && input.shift && key === 'q') {
      allowQuit = true;
      app.exit(0);
      return;
    }
    const blockedCombo = mod && ['r', 'w', 'n', 't', 'p', '-', '=', '+', '0'].includes(key);
    const blockedKey = ['F5', 'F11', 'F12'].includes(input.key);
    const devtools = mod && input.shift && (key === 'i' || key === 'j' || key === 'c');
    if (blockedCombo || blockedKey || devtools) event.preventDefault();
  });

  // Impede abrir novas janelas (links externos, window.open).
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Impede fechar a janela, exceto na saida de admin.
  win.on('close', (e) => {
    if (!allowQuit) e.preventDefault();
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(APP_ROOT, 'dist', 'index.html'));

  return win;
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
