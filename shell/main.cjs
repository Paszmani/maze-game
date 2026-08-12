/**
 * Processo principal do Electron — a casca desktop do jogo.
 *
 * Janela NORMAL (sem kiosk/lockdown) + gravacao de lead em disco via `fs`
 * (1 JSON por lead + CSV consolidado, regenerado a cada gravacao p/ unir colunas).
 *
 * Layout de pastas esperado (ao lado do .exe em producao):
 *   Maze Game.exe
 *   config.json        -> { "themeId": "...", "terminalId": "..." }
 *   themes/<id>/...     -> temas externos (opcional; fallback ao bundle)
 *   data/leads/         -> SAIDA: leads.csv + raw/<...>.json  (o CSV dos leads)
 */

const { app, BrowserWindow, ipcMain, shell, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const APP_ROOT = path.join(__dirname, '..');
const APP_DIST = path.join(APP_ROOT, 'dist');
const DEV_URL = process.env.KIOSK_DEV_URL;

// O jogo e servido por um esquema PROPRIO (`app://`) em vez de `file://`. Motivo:
// o bundle do Vite usa modulos ES com code-splitting (main importa outros chunks);
// o Chromium bloqueia import de modulo por CORS sobre `file://`, deixando a janela
// em branco no .exe empacotado. Sob um esquema standard/secure isso funciona.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

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

// Pasta GRAVAVEL de temas (ao lado do exe). O bundle (dist/themes) e read-only
// dentro do asar, entao temas criados/editados pelo editor vao para ca.
function externalThemesDir() {
  return path.join(baseDir(), 'themes');
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

// Embute como data-URI cada caminho relativo de imagem de um array (ghosts, powerPellets).
function inlineArray(arr, dir) {
  return arr.map((v) => (typeof v === 'string' && v && !/^(data:|https?:)/.test(v) ? toDataUri(dir, v) : v));
}

function inlineSprites(raw, dir) {
  if (raw.branding) inlineField(raw.branding, 'logo', dir);
  const s = raw.sprites;
  if (!s) return;
  for (const k of ['player', 'pellet', 'powerPellet', 'frightened', 'fruit', 'mazeBackground', 'attractBackground']) {
    inlineField(s, k, dir);
  }
  if (Array.isArray(s.ghosts)) {
    s.ghosts = inlineArray(s.ghosts, dir);
  } else if (s.ghosts && typeof s.ghosts === 'object') {
    for (const k of Object.keys(s.ghosts)) inlineField(s.ghosts, k, dir);
  }
  // Power-pellets individuais (4 slots): mesmo tratamento dos ghosts em array.
  if (Array.isArray(s.powerPellets)) s.powerPellets = inlineArray(s.powerPellets, dir);
}

// --- CSV consolidado (uniao de colunas) ------------------------------------

const { leadsToCsv, CSV_BOM } = require('./csv.cjs');

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
  fs.writeFileSync(path.join(dir, 'leads.csv'), CSV_BOM + leadsToCsv(leads), 'utf8');
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

  ipcMain.handle('kiosk:saveTheme', (_event, theme) => {
    const id = (theme && typeof theme.id === 'string' && theme.id) || 'custom';
    const dir = path.join(externalThemesDir(), id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify(theme, null, 2), 'utf8');
    // Aponta o totem para este tema.
    const cfgFile = path.join(baseDir(), 'config.json');
    let cfg = {};
    try {
      cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
    } catch {
      /* config novo */
    }
    cfg.themeId = id;
    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2), 'utf8');
    return { ok: true, id };
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

// --- Janela -----------------------------------------------------------------

// Janela NORMAL: sem kiosk/lockdown. Pode minimizar, fechar, usar atalhos e
// alternar tela cheia (F11) livremente.
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 1000,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadURL('app://-/index.html');

  return win;
}

/**
 * Serve os arquivos de `dist/` pelo esquema `app://`. A URL `app://-/<caminho>`
 * mapeia para `dist/<caminho>` (host '-' e so um placeholder). Guarda contra
 * path traversal para nunca sair da pasta do bundle.
 */
function registerAppProtocol() {
  protocol.handle('app', (req) => {
    let rel = decodeURIComponent(new URL(req.url).pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(APP_DIST, rel));
    if (file !== APP_DIST && !file.startsWith(APP_DIST + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

app.whenReady().then(() => {
  if (!DEV_URL) registerAppProtocol();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
