/**
 * Editor de Tema — tela de customizacao (admin), separada do jogo.
 *
 * Monta o MESMO theme.json que o jogo ja consome: cores, branding, estilo da
 * Attract, gameplay, campos de lead e sprites (imagens viram data-URI embutida).
 * A previa usa a engine real via iframe `/?preview=1`, que le o rascunho do
 * localStorage. Nada de formato novo — reaproveita todo o pipeline de tema.
 *
 * NAO faz parte do fluxo do totem: e ferramenta do operador para gerar temas.
 */

import { PREVIEW_KEY, APPLIED_KEY, loadAppliedTheme } from '../render/theme-loader.js';
import { getKiosk } from '../shell/bridge.js';
import { isCapacitorNative, makeCapacitorBridge } from '../platform/capacitor-kiosk.js';
import { exportTextFile } from '../platform/file-export.js';

// O editor.html NAO roda o main.ts, entao precisa instalar a ponte nativa aqui —
// senao no Android `getKiosk()` seria undefined e "Aplicar e voltar" nunca
// gravaria o tema no disco (o jogo carrega do disco no totem) => customizacao
// "nao aplicava" no Android.
if (!window.kiosk && isCapacitorNative()) {
  window.kiosk = makeCapacitorBridge();
}

const GHOST_LABELS = ['Blinky', 'Pinky', 'Inky', 'Clyde'] as const;
const LEAD_TYPES = ['text', 'email', 'tel', 'select', 'checkbox'] as const;

interface AttractTextDraft {
  visible: boolean;
  color: string;
  size: number;
  y: number;
}
interface DraftAttract {
  showPlayer: boolean;
  title: AttractTextDraft;
  headline: AttractTextDraft;
  cta: AttractTextDraft & { background: string };
  logo: { visible: boolean; scale: number; y: number };
}
interface LeadFieldDraft {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string; // separadas por virgula no editor
}
type Quad = [string, string, string, string];
interface Draft {
  id: string;
  name: string;
  colors: {
    maze: string; background: string; pellet: string; power: string; player: string;
    frightened: string; eaten: string; uiAccent: string; text: string; ghosts: Quad;
  };
  branding: { attractHeadline: string; ctaButton: string; leadHeadline: string; logo: string };
  gameplay: { playerSpeed: number; ghostSpeed: number; powerDurationMs: number; fruitAsPower: boolean };
  ghostLabel: { enabled: boolean; color: string; texts: Quad };
  sprites: {
    player: string; pellet: string; frightened: string; fruit: string;
    powerPellets: Quad; ghosts: Quad; mazeBackground: string; attractBackground: string;
  };
  attract: DraftAttract;
  leadForm: { enabled: boolean; fields: LeadFieldDraft[] };
}

function makeDraft(): Draft {
  return {
    id: 'meu-tema',
    name: 'Meu Tema',
    colors: {
      maze: '#2b2b2b', background: '#000000', pellet: '#ffffff', power: '#ffcc00', player: '#ffcc00',
      frightened: '#3355ff', eaten: '#555555', uiAccent: '#bbbbbb', text: '#ffffff',
      ghosts: ['#ff0000', '#ff66cc', '#00ffff', '#ff9900'],
    },
    branding: { attractHeadline: 'DESVIE. COLETE. VENÇA.', ctaButton: 'TOCAR PARA JOGAR', leadHeadline: 'Cadastre-se e concorra a um brinde!', logo: '' },
    gameplay: { playerSpeed: 1.15, ghostSpeed: 0.8, powerDurationMs: 7500, fruitAsPower: false },
    ghostLabel: { enabled: false, color: '#ffffff', texts: ['', '', '', ''] },
    sprites: { player: '', pellet: '', frightened: '', fruit: '', powerPellets: ['', '', '', ''], ghosts: ['', '', '', ''], mazeBackground: '', attractBackground: '' },
    attract: {
      showPlayer: true,
      title: { visible: true, color: '#ffffff', size: 24, y: 0.2 },
      headline: { visible: true, color: '#bbbbbb', size: 30, y: 0.4 },
      cta: { visible: true, color: '#000000', background: '#ffcc00', size: 26, y: 0.66 },
      logo: { visible: true, scale: 1, y: 0.5 },
    },
    leadForm: {
      enabled: true,
      fields: [
        { id: 'name', label: 'Nome', type: 'text', required: true, options: '' },
        { id: 'email', label: 'E-mail', type: 'email', required: true, options: '' },
      ],
    },
  };
}

const draft = makeDraft();

// --- DOM helpers -----------------------------------------------------------

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  Object.assign(el, props);
  for (const k of kids) el.append(k);
  return el;
}

function row(label: string, control: HTMLElement): HTMLElement {
  return h('div', { className: 'row' }, h('label', { textContent: label }), control);
}

function colorInput(get: () => string, set: (v: string) => void): HTMLInputElement {
  const i = h('input');
  i.type = 'color';
  i.value = get();
  i.addEventListener('input', () => { set(i.value); schedule(); });
  return i;
}
function textInput(get: () => string, set: (v: string) => void): HTMLInputElement {
  const i = h('input');
  i.type = 'text';
  i.value = get();
  i.addEventListener('input', () => { set(i.value); schedule(); });
  return i;
}
function numberInput(get: () => number, set: (v: number) => void, step: number): HTMLInputElement {
  const i = h('input');
  i.type = 'number';
  i.step = String(step);
  i.value = String(get());
  i.addEventListener('input', () => { const n = parseFloat(i.value); if (Number.isFinite(n)) set(n); schedule(); });
  return i;
}
function checkInput(get: () => boolean, set: (v: boolean) => void): HTMLInputElement {
  const i = h('input');
  i.type = 'checkbox';
  i.checked = get();
  i.addEventListener('change', () => { set(i.checked); schedule(); });
  return i;
}
function selectInput(opts: readonly string[], get: () => string, set: (v: string) => void): HTMLSelectElement {
  const s = h('select');
  for (const o of opts) s.append(h('option', { value: o, textContent: o }));
  s.value = get();
  s.addEventListener('change', () => { set(s.value); schedule(); });
  return s;
}

function readRawDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('falha ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

/**
 * Le a imagem e REDIMENSIONA para no maximo `maxPx` no maior lado, re-exportando
 * como PNG (preserva transparencia dos sprites). Sprites/fundos de jogo sao
 * pequenos na tela; guardar a foto original (varios MB) estourava a cota do
 * localStorage (web) e o Filesystem do totem (Android) — e ai as imagens custom
 * "sumiam". Agora o data-URI fica em poucos KB.
 */
async function readDataUrl(file: File, maxPx: number): Promise<string> {
  const raw = await readRawDataUrl(file);
  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const hh = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(raw);
      ctx.drawImage(img, 0, 0, w, hh);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(raw);
      }
    };
    img.onerror = () => resolve(raw); // formato exotico: mantem o original
    img.src = raw;
  });
}

function fileRow(label: string, get: () => string, set: (v: string) => void, maxPx = 128): HTMLElement {
  const img = h('img');
  const refresh = (): void => { const v = get(); img.src = v; img.style.visibility = v ? 'visible' : 'hidden'; };
  const file = h('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    set(await readDataUrl(f, maxPx));
    refresh();
    schedule();
  });
  const clear = h('button', { className: 'ghost small', textContent: 'remover', type: 'button' });
  clear.addEventListener('click', () => { set(''); file.value = ''; refresh(); schedule(); });
  refresh();
  return row(label, h('div', { className: 'sprite' }, img, file, clear));
}

// --- Secoes ----------------------------------------------------------------

const sections = document.getElementById('sections') as HTMLElement;

function section(title: string, open: boolean, ...rows: HTMLElement[]): HTMLElement {
  const d = h('details');
  d.open = open;
  d.append(h('summary', { textContent: title }), ...rows);
  return d;
}

const COLOR_FIELDS: { key: Exclude<keyof Draft['colors'], 'ghosts'>; label: string }[] = [
  { key: 'maze', label: 'Labirinto' }, { key: 'background', label: 'Fundo' },
  { key: 'pellet', label: 'Pellet' }, { key: 'power', label: 'Power-pellet' },
  { key: 'player', label: 'Player' }, { key: 'frightened', label: 'Frightened' },
  { key: 'eaten', label: 'Comido (olhos)' }, { key: 'uiAccent', label: 'Destaque' },
  { key: 'text', label: 'Texto' },
];

const SPRITE_FIELDS: { key: Exclude<keyof Draft['sprites'], 'ghosts' | 'powerPellets'>; label: string }[] = [
  { key: 'player', label: 'Player' }, { key: 'pellet', label: 'Pellet' },
  { key: 'frightened', label: 'Frightened' },
  { key: 'fruit', label: 'Fruta' },
  { key: 'mazeBackground', label: 'Fundo do jogo' }, { key: 'attractBackground', label: 'Fundo da Attract' },
];

function attractTextRows(label: string, t: AttractTextDraft): HTMLElement[] {
  return [
    row(`${label} — visível`, checkInput(() => t.visible, (v) => (t.visible = v))),
    row(`${label} — cor`, colorInput(() => t.color, (v) => (t.color = v))),
    row(`${label} — tamanho`, numberInput(() => t.size, (v) => (t.size = v), 1)),
    row(`${label} — posição Y (0–1)`, numberInput(() => t.y, (v) => (t.y = v), 0.02)),
  ];
}

const leadContainer = h('div');

function renderLead(): void {
  leadContainer.replaceChildren();
  leadContainer.append(
    row('Capturar leads ao fim do jogo', checkInput(() => draft.leadForm.enabled, (v) => (draft.leadForm.enabled = v))),
  );
  draft.leadForm.fields.forEach((f, i) => {
    const remove = h('button', { className: 'ghost small', textContent: 'remover campo', type: 'button' });
    remove.addEventListener('click', () => { draft.leadForm.fields.splice(i, 1); renderLead(); schedule(); });
    const optsRow = row('opções (vírgula)', textInput(() => f.options, (v) => (f.options = v)));
    leadContainer.append(
      h('div', { className: 'lead-field' },
        h('div', { className: 'grid' },
          row('id', textInput(() => f.id, (v) => (f.id = v))),
          row('rótulo', textInput(() => f.label, (v) => (f.label = v))),
          row('tipo', selectInput(LEAD_TYPES, () => f.type, (v) => (f.type = v))),
          row('obrigatório', checkInput(() => f.required, (v) => (f.required = v))),
        ),
        optsRow,
        remove,
      ),
    );
  });
  const add = h('button', { className: 'ghost small', textContent: '+ adicionar campo', type: 'button' });
  add.addEventListener('click', () => { draft.leadForm.fields.push({ id: '', label: '', type: 'text', required: false, options: '' }); renderLead(); schedule(); });
  leadContainer.append(add);
}

function buildAll(): void {
  sections.replaceChildren();

  sections.append(section('Identidade', true,
    row('ID (pasta/URL)', textInput(() => draft.id, (v) => (draft.id = v))),
    row('Nome da marca', textInput(() => draft.name, (v) => (draft.name = v))),
  ));

  sections.append(section('Cores', false,
    ...COLOR_FIELDS.map((f) => row(f.label, colorInput(() => draft.colors[f.key], (v) => (draft.colors[f.key] = v)))),
    ...GHOST_LABELS.map((label, i) => row(`Fantasma ${label}`, colorInput(() => draft.colors.ghosts[i]!, (v) => (draft.colors.ghosts[i] = v)))),
  ));

  const bgKeys = new Set(['mazeBackground', 'attractBackground']);
  sections.append(section('Sprites (imagens)', false,
    ...SPRITE_FIELDS.map((f) =>
      fileRow(f.label, () => draft.sprites[f.key], (v) => (draft.sprites[f.key] = v), bgKeys.has(f.key) ? 640 : 128),
    ),
    // Power-pellets individuais: 4 slots (cantos). Vazio => bolinha classica; com
    // imagem => aquele power-pellet vira o card grande. maxPx maior: sao maiores na tela.
    ...[0, 1, 2, 3].map((i) =>
      fileRow(`Power-pellet ${i + 1}`, () => draft.sprites.powerPellets[i]!, (v) => (draft.sprites.powerPellets[i] = v), 256),
    ),
    ...GHOST_LABELS.map((label, i) => fileRow(`Fantasma ${label}`, () => draft.sprites.ghosts[i]!, (v) => (draft.sprites.ghosts[i] = v))),
  ));

  sections.append(section('Textos (branding)', false,
    row('Headline da Attract', textInput(() => draft.branding.attractHeadline, (v) => (draft.branding.attractHeadline = v))),
    row('Botão (CTA)', textInput(() => draft.branding.ctaButton, (v) => (draft.branding.ctaButton = v))),
    row('Headline do lead', textInput(() => draft.branding.leadHeadline, (v) => (draft.branding.leadHeadline = v))),
  ));

  sections.append(section('Tela Attract', false,
    row('Mostrar player animado', checkInput(() => draft.attract.showPlayer, (v) => (draft.attract.showPlayer = v))),
    ...attractTextRows('Título', draft.attract.title),
    // Logo — selecao e controles ficam ENTRE o titulo e a headline.
    fileRow('Logo (imagem)', () => draft.branding.logo, (v) => (draft.branding.logo = v), 512),
    row('Logo — visível', checkInput(() => draft.attract.logo.visible, (v) => (draft.attract.logo.visible = v))),
    row('Logo — escala', numberInput(() => draft.attract.logo.scale, (v) => (draft.attract.logo.scale = v), 0.1)),
    row('Logo — posição Y (0–1)', numberInput(() => draft.attract.logo.y, (v) => (draft.attract.logo.y = v), 0.02)),
    ...attractTextRows('Headline', draft.attract.headline),
    ...attractTextRows('CTA', draft.attract.cta),
    row('CTA — cor de fundo', colorInput(() => draft.attract.cta.background, (v) => (draft.attract.cta.background = v))),
  ));

  sections.append(section('Gameplay', false,
    row('Velocidade do player', numberInput(() => draft.gameplay.playerSpeed, (v) => (draft.gameplay.playerSpeed = v), 0.05)),
    row('Velocidade dos fantasmas', numberInput(() => draft.gameplay.ghostSpeed, (v) => (draft.gameplay.ghostSpeed = v), 0.05)),
    row('Duração do power (ms)', numberInput(() => draft.gameplay.powerDurationMs, (v) => (draft.gameplay.powerDurationMs = v), 500)),
    row('Fruta ativa o frightened (como power-pellet)', checkInput(() => draft.gameplay.fruitAsPower, (v) => (draft.gameplay.fruitAsPower = v))),
  ));

  sections.append(section('Texto nos fantasmas', false,
    row('Mostrar texto embaixo dos inimigos', checkInput(() => draft.ghostLabel.enabled, (v) => (draft.ghostLabel.enabled = v))),
    row('Cor do texto', colorInput(() => draft.ghostLabel.color, (v) => (draft.ghostLabel.color = v))),
    // Texto proprio por fantasma (vazio => aquele fica sem rotulo).
    ...GHOST_LABELS.map((label, i) =>
      row(`Texto — ${label}`, textInput(() => draft.ghostLabel.texts[i]!, (v) => (draft.ghostLabel.texts[i] = v))),
    ),
  ));

  renderLead();
  sections.append(section('Formulário de lead', false, leadContainer));
}

// --- Exportar / importar / previa -----------------------------------------

function buildExport(): Record<string, unknown> {
  const sp = draft.sprites;
  const sprites: Record<string, unknown> = {};
  for (const f of SPRITE_FIELDS) if (sp[f.key]) sprites[f.key] = sp[f.key];
  const ghosts = sp.ghosts.map((s) => s || null);
  if (ghosts.some((g) => g)) sprites.ghosts = ghosts;
  const powerPellets = sp.powerPellets.map((s) => s || null);
  if (powerPellets.some((p) => p)) sprites.powerPellets = powerPellets;

  const out: Record<string, unknown> = {
    id: draft.id,
    name: draft.name,
    colors: { ...draft.colors, ghosts: [...draft.colors.ghosts] },
    branding: {
      attractHeadline: draft.branding.attractHeadline,
      ctaButton: draft.branding.ctaButton,
      leadHeadline: draft.branding.leadHeadline,
      ...(draft.branding.logo ? { logo: draft.branding.logo } : {}),
    },
    gameplay: { ...draft.gameplay },
    ghostLabel: { enabled: draft.ghostLabel.enabled, color: draft.ghostLabel.color, texts: [...draft.ghostLabel.texts] },
    attract: {
      showPlayer: draft.attract.showPlayer,
      title: { ...draft.attract.title },
      headline: { ...draft.attract.headline },
      cta: { ...draft.attract.cta },
      logo: { ...draft.attract.logo },
    },
    leadForm: {
      enabled: draft.leadForm.enabled,
      fields: draft.leadForm.fields
        .filter((f) => f.id && f.label)
        .map((f) => {
          const o: Record<string, unknown> = { id: f.id, label: f.label, type: f.type, required: f.required };
          const opts = f.options.split(',').map((s) => s.trim()).filter(Boolean);
          if (opts.length) o.options = opts;
          return o;
        }),
    },
  };
  if (Object.keys(sprites).length) out.sprites = sprites;
  return out;
}

let timer: number | undefined;

/**
 * Sem prévia embutida (padrão dos editores dos 3 jogos): o rascunho é salvo em
 * PREVIEW_KEY e o botão "Testar jogo" abre o jogo real com ?preview=1.
 */
function pushDraft(): void {
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(buildExport()));
}

function schedule(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = window.setTimeout(pushDraft, 400);
}

function download(): void {
  // No Android a ancora <a download> nao funciona — o helper decide entre
  // download (web/Electron) e folha de compartilhamento nativa (Capacitor).
  void exportTextFile(`${draft.id || 'tema'}.json`, JSON.stringify(buildExport(), null, 2), 'application/json');
}

function asStr(v: unknown, fb: string): string { return typeof v === 'string' ? v : fb; }
function asNum(v: unknown, fb: number): number { return typeof v === 'number' && Number.isFinite(v) ? v : fb; }
function asBool(v: unknown, fb: boolean): boolean { return typeof v === 'boolean' ? v : fb; }

/* eslint-disable @typescript-eslint/no-explicit-any */
function importDraft(o: any): void {
  if (typeof o !== 'object' || o === null) return;
  draft.id = asStr(o.id, draft.id);
  draft.name = asStr(o.name, draft.name);

  if (o.colors) {
    for (const f of COLOR_FIELDS) draft.colors[f.key] = asStr(o.colors[f.key], draft.colors[f.key]);
    const g = o.colors.ghosts;
    if (Array.isArray(g)) GHOST_LABELS.forEach((_, i) => (draft.colors.ghosts[i] = asStr(g[i], draft.colors.ghosts[i]!)));
    else if (g && typeof g === 'object') ['blinky', 'pinky', 'inky', 'clyde'].forEach((p, i) => (draft.colors.ghosts[i] = asStr(g[p], draft.colors.ghosts[i]!)));
  }
  if (o.branding) {
    draft.branding.attractHeadline = asStr(o.branding.attractHeadline, draft.branding.attractHeadline);
    draft.branding.ctaButton = asStr(o.branding.ctaButton, draft.branding.ctaButton);
    draft.branding.leadHeadline = asStr(o.branding.leadHeadline, draft.branding.leadHeadline);
    draft.branding.logo = asStr(o.branding.logo, draft.branding.logo);
  }
  if (o.gameplay) {
    draft.gameplay.playerSpeed = asNum(o.gameplay.playerSpeed, draft.gameplay.playerSpeed);
    draft.gameplay.ghostSpeed = asNum(o.gameplay.ghostSpeed, draft.gameplay.ghostSpeed);
    draft.gameplay.powerDurationMs = asNum(o.gameplay.powerDurationMs, draft.gameplay.powerDurationMs);
    draft.gameplay.fruitAsPower = asBool(o.gameplay.fruitAsPower, draft.gameplay.fruitAsPower);
  }
  if (o.ghostLabel) {
    draft.ghostLabel.enabled = asBool(o.ghostLabel.enabled, draft.ghostLabel.enabled);
    draft.ghostLabel.color = asStr(o.ghostLabel.color, draft.ghostLabel.color);
    const tx = o.ghostLabel.texts;
    if (Array.isArray(tx)) {
      GHOST_LABELS.forEach((_, i) => (draft.ghostLabel.texts[i] = asStr(tx[i], draft.ghostLabel.texts[i]!)));
    } else if (typeof o.ghostLabel.text === 'string') {
      // Legado: um texto unico -> replica para os quatro.
      draft.ghostLabel.texts = [o.ghostLabel.text, o.ghostLabel.text, o.ghostLabel.text, o.ghostLabel.text];
    }
  }
  if (o.sprites) {
    for (const f of SPRITE_FIELDS) draft.sprites[f.key] = asStr(o.sprites[f.key], draft.sprites[f.key]);
    const g = o.sprites.ghosts;
    if (Array.isArray(g)) GHOST_LABELS.forEach((_, i) => (draft.sprites.ghosts[i] = asStr(g[i], draft.sprites.ghosts[i]!)));
    else if (g && typeof g === 'object') ['blinky', 'pinky', 'inky', 'clyde'].forEach((p, i) => (draft.sprites.ghosts[i] = asStr(g[p], draft.sprites.ghosts[i]!)));
    const pp = o.sprites.powerPellets;
    if (Array.isArray(pp)) [0, 1, 2, 3].forEach((i) => (draft.sprites.powerPellets[i] = asStr(pp[i], draft.sprites.powerPellets[i]!)));
  }
  if (o.attract) {
    draft.attract.showPlayer = asBool(o.attract.showPlayer, draft.attract.showPlayer);
    for (const k of ['title', 'headline', 'cta'] as const) {
      const t = o.attract[k];
      if (t && typeof t === 'object') {
        draft.attract[k].visible = asBool(t.visible, draft.attract[k].visible);
        draft.attract[k].color = asStr(t.color, draft.attract[k].color);
        draft.attract[k].size = asNum(t.size, draft.attract[k].size);
        draft.attract[k].y = asNum(t.y, draft.attract[k].y);
      }
    }
    if (o.attract.cta) draft.attract.cta.background = asStr(o.attract.cta.background, draft.attract.cta.background);
    if (o.attract.logo) {
      draft.attract.logo.visible = asBool(o.attract.logo.visible, draft.attract.logo.visible);
      draft.attract.logo.scale = asNum(o.attract.logo.scale, draft.attract.logo.scale);
      draft.attract.logo.y = asNum(o.attract.logo.y, draft.attract.logo.y);
    }
  }
  if (o.leadForm) draft.leadForm.enabled = asBool(o.leadForm.enabled, draft.leadForm.enabled);
  if (o.leadForm && Array.isArray(o.leadForm.fields)) {
    draft.leadForm.fields = o.leadForm.fields.map((f: any) => ({
      id: asStr(f?.id, ''),
      label: asStr(f?.label, ''),
      type: asStr(f?.type, 'text'),
      required: asBool(f?.required, false),
      options: Array.isArray(f?.options) ? f.options.filter((s: unknown) => typeof s === 'string').join(', ') : '',
    }));
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Wire up ---------------------------------------------------------------

const kiosk = getKiosk();

/**
 * "Aplicar e voltar ao jogo": PERSISTE o tema (o que faltava — antes o jogo
 * recarregava o theme.json do disco e perdia as edicoes). No web grava em
 * localStorage (APPLIED_KEY, que o loader le); no totem grava no disco via ponte.
 */
async function applyAndReturn(btn: HTMLButtonElement): Promise<void> {
  const theme = buildExport();
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Aplicando…';
  try {
    localStorage.setItem(APPLIED_KEY, JSON.stringify(theme));
  } catch {
    /* cota cheia: segue mesmo assim (o totem usa o disco) */
  }
  if (kiosk) {
    try {
      await kiosk.saveTheme(theme);
    } catch {
      btn.disabled = false;
      btn.textContent = label;
      alert('Falha ao salvar o tema no totem.');
      return;
    }
  }
  window.location.href = 'index.html';
}

for (const id of ['apply', 'apply-mobile']) {
  const b = document.getElementById(id) as HTMLButtonElement | null;
  b?.addEventListener('click', () => void applyAndReturn(b));
}

// Caminho relativo: funciona servido (web) e via file:// (Electron).
(document.getElementById('test-game') as HTMLButtonElement).addEventListener('click', () => {
  pushDraft();
  window.open('index.html?preview=1', '_blank');
});
(document.getElementById('download') as HTMLButtonElement).addEventListener('click', download);

// No totem (Electron/Android), botao extra: salva no disco SEM sair do editor.
const saveBtn = document.getElementById('save-disk') as HTMLButtonElement;
if (kiosk) {
  saveBtn.style.display = '';
  saveBtn.addEventListener('click', async () => {
    try {
      await kiosk.saveTheme(buildExport());
      alert('Tema salvo no totem.');
    } catch {
      alert('Falha ao salvar o tema.');
    }
  });
}

// No totem, botao para o operador extrair os leads: Electron abre a pasta no
// explorador; Android abre a folha de compartilhamento com o CSV (nao ha
// "explorador" no app — compartilhar por e-mail/Drive/WhatsApp e o caminho real).
const leadsBtn = document.getElementById('reveal-leads') as HTMLButtonElement;
if (kiosk) {
  leadsBtn.style.display = '';
  leadsBtn.addEventListener('click', async () => {
    try {
      await kiosk.revealLeads();
    } catch {
      alert('Não foi possível abrir os leads (ainda não há nenhum cadastro salvo?).');
    }
  });
}

(document.getElementById('import') as HTMLInputElement).addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    importDraft(JSON.parse(await file.text()));
    buildAll();
    pushDraft();
  } catch {
    alert('JSON inválido.');
  }
});

// Pre-carrega o tema atualmente APLICADO para editar sobre ele (e nao recomecar
// do zero a cada visita). Totem le do disco; web, do localStorage.
async function init(): Promise<void> {
  try {
    const existing = kiosk ? await kiosk.loadTheme() : loadAppliedTheme();
    if (existing) importDraft(existing);
  } catch {
    /* sem tema salvo ainda: usa o rascunho default */
  }
  buildAll();
  pushDraft();
}

void init();
