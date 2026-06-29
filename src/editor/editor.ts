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

import { PREVIEW_KEY } from '../render/theme-loader.js';
import { getKiosk } from '../shell/bridge.js';

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
  gameplay: { playerSpeed: number; ghostSpeed: number; powerDurationMs: number };
  sprites: {
    player: string; pellet: string; powerPellet: string; frightened: string;
    ghosts: Quad; mazeBackground: string; attractBackground: string;
  };
  attract: DraftAttract;
  leadForm: { fields: LeadFieldDraft[] };
}

function makeDraft(): Draft {
  return {
    id: 'meu-tema',
    name: 'Meu Tema',
    colors: {
      maze: '#1b3a8f', background: '#000010', pellet: '#ffffff', power: '#ffcc00', player: '#ffcc00',
      frightened: '#2233ff', eaten: '#556699', uiAccent: '#e30613', text: '#ffffff',
      ghosts: ['#ff0000', '#ff66cc', '#00ffff', '#ff9900'],
    },
    branding: { attractHeadline: 'DESVIE. COLETE. VENÇA.', ctaButton: 'TOCAR PARA JOGAR', leadHeadline: 'Cadastre-se e concorra a um brinde!', logo: '' },
    gameplay: { playerSpeed: 1.0, ghostSpeed: 0.9, powerDurationMs: 6000 },
    sprites: { player: '', pellet: '', powerPellet: '', frightened: '', ghosts: ['', '', '', ''], mazeBackground: '', attractBackground: '' },
    attract: {
      showPlayer: true,
      title: { visible: true, color: '#e30613', size: 24, y: 0.2 },
      headline: { visible: true, color: '#ffffff', size: 30, y: 0.4 },
      cta: { visible: true, color: '#000010', background: '#ffcc00', size: 26, y: 0.66 },
      logo: { visible: true, scale: 1, y: 0.5 },
    },
    leadForm: {
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

function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('falha ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

function fileRow(label: string, get: () => string, set: (v: string) => void): HTMLElement {
  const img = h('img');
  const refresh = (): void => { const v = get(); img.src = v; img.style.visibility = v ? 'visible' : 'hidden'; };
  const file = h('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    set(await readDataUrl(f));
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

const SPRITE_FIELDS: { key: Exclude<keyof Draft['sprites'], 'ghosts'>; label: string }[] = [
  { key: 'player', label: 'Player' }, { key: 'pellet', label: 'Pellet' },
  { key: 'powerPellet', label: 'Power-pellet' }, { key: 'frightened', label: 'Frightened' },
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

  sections.append(section('Sprites (imagens)', false,
    ...SPRITE_FIELDS.map((f) => fileRow(f.label, () => draft.sprites[f.key], (v) => (draft.sprites[f.key] = v))),
    fileRow('Logo', () => draft.branding.logo, (v) => (draft.branding.logo = v)),
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
    ...attractTextRows('Headline', draft.attract.headline),
    ...attractTextRows('CTA', draft.attract.cta),
    row('CTA — cor de fundo', colorInput(() => draft.attract.cta.background, (v) => (draft.attract.cta.background = v))),
    row('Logo — visível', checkInput(() => draft.attract.logo.visible, (v) => (draft.attract.logo.visible = v))),
    row('Logo — escala', numberInput(() => draft.attract.logo.scale, (v) => (draft.attract.logo.scale = v), 0.1)),
    row('Logo — posição Y (0–1)', numberInput(() => draft.attract.logo.y, (v) => (draft.attract.logo.y = v), 0.02)),
  ));

  sections.append(section('Gameplay', false,
    row('Velocidade do player', numberInput(() => draft.gameplay.playerSpeed, (v) => (draft.gameplay.playerSpeed = v), 0.05)),
    row('Velocidade dos fantasmas', numberInput(() => draft.gameplay.ghostSpeed, (v) => (draft.gameplay.ghostSpeed = v), 0.05)),
    row('Duração do power (ms)', numberInput(() => draft.gameplay.powerDurationMs, (v) => (draft.gameplay.powerDurationMs = v), 500)),
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
    attract: {
      showPlayer: draft.attract.showPlayer,
      title: { ...draft.attract.title },
      headline: { ...draft.attract.headline },
      cta: { ...draft.attract.cta },
      logo: { ...draft.attract.logo },
    },
    leadForm: {
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

const iframe = document.getElementById('preview') as HTMLIFrameElement;
let previewTick = 0;
let timer: number | undefined;

function updatePreview(): void {
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(buildExport()));
  // Caminho relativo: funciona servido (web) e via file:// (Electron).
  iframe.src = `index.html?preview=1&t=${++previewTick}`;
}

function schedule(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = window.setTimeout(updatePreview, 400);
}

function download(): void {
  const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `${draft.id || 'tema'}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
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
  }
  if (o.sprites) {
    for (const f of SPRITE_FIELDS) draft.sprites[f.key] = asStr(o.sprites[f.key], draft.sprites[f.key]);
    const g = o.sprites.ghosts;
    if (Array.isArray(g)) GHOST_LABELS.forEach((_, i) => (draft.sprites.ghosts[i] = asStr(g[i], draft.sprites.ghosts[i]!)));
    else if (g && typeof g === 'object') ['blinky', 'pinky', 'inky', 'clyde'].forEach((p, i) => (draft.sprites.ghosts[i] = asStr(g[p], draft.sprites.ghosts[i]!)));
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

(document.getElementById('refresh') as HTMLButtonElement).addEventListener('click', updatePreview);
(document.getElementById('back') as HTMLButtonElement).addEventListener('click', () => {
  window.location.href = 'index.html';
});
(document.getElementById('download') as HTMLButtonElement).addEventListener('click', download);

// No totem (Electron), salva o tema direto no disco e aponta o config para ele.
const kiosk = getKiosk();
const saveBtn = document.getElementById('save-disk') as HTMLButtonElement;
if (kiosk) {
  saveBtn.style.display = '';
  saveBtn.addEventListener('click', async () => {
    try {
      await kiosk.saveTheme(buildExport());
      alert('Tema salvo no totem. Use "Voltar ao jogo" para aplicar.');
    } catch {
      alert('Falha ao salvar o tema.');
    }
  });
}
(document.getElementById('import') as HTMLInputElement).addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    importDraft(JSON.parse(await file.text()));
    buildAll();
    updatePreview();
  } catch {
    alert('JSON inválido.');
  }
});

buildAll();
updatePreview();
