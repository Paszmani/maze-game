/**
 * Carregador de tema (lado render). Busca o theme.json da marca ativa, valida via
 * `resolveTheme` e devolve um `Theme`. Falha de rede/arquivo -> tema default, sem
 * quebrar. A selecao da marca vem de `?theme=<id>` (default 'gsb-default').
 *
 * No dev, os temas sao servidos de `public/themes/<id>/theme.json`. No Electron
 * (modulo 9) este loader passa a ler a pasta de temas do disco via fs.
 */

import { resolveTheme, type Theme } from '../theme/theme-schema.js';
import { DEFAULT_THEME } from '../theme/default-theme.js';
import { getKiosk } from '../shell/bridge.js';

/** Chave do localStorage onde o editor grava o tema em edicao para a previa. */
export const PREVIEW_KEY = 'kioskMazeThemeDraft';

export function activeThemeId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('theme') ?? 'gsb-default';
}

export function themeUrl(id: string = activeThemeId()): string {
  return `themes/${id}/theme.json`;
}

export async function loadTheme(url: string = themeUrl()): Promise<Theme> {
  try {
    const res = await fetch(url);
    if (!res.ok) return DEFAULT_THEME;
    return resolveTheme(await res.json());
  } catch {
    return DEFAULT_THEME;
  }
}

export interface ActiveTheme {
  theme: Theme;
  /** Pasta-base dos assets do tema. Vazia quando os sprites sao data-URIs. */
  base: string;
}

/**
 * Decide a fonte do tema: `?preview=1` le o rascunho do editor (localStorage,
 * sprites como data-URI -> base vazia); senao busca `themes/<id>/theme.json`.
 */
export async function loadActiveTheme(): Promise<ActiveTheme> {
  const params = new URLSearchParams(window.location.search);

  // Editor (browser): le o rascunho do localStorage.
  if (params.has('preview')) {
    try {
      const raw = JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? '{}');
      return { theme: resolveTheme(raw), base: '' };
    } catch {
      return { theme: DEFAULT_THEME, base: '' };
    }
  }

  // Totem nativo (Electron/Android): tema do disco, sprites ja como data-URI.
  const kiosk = getKiosk();
  if (kiosk) {
    try {
      return { theme: resolveTheme(await kiosk.loadTheme()), base: '' };
    } catch {
      return { theme: DEFAULT_THEME, base: '' };
    }
  }

  // Web: busca o arquivo servido.
  const id = activeThemeId();
  return { theme: await loadTheme(themeUrl(id)), base: `themes/${id}/` };
}

/** Caminhos absolutos (data:, http, blob:, /) nao recebem a pasta-base na frente. */
export function assetUrl(base: string, path: string): string {
  return /^(data:|https?:|blob:|\/)/.test(path) ? path : base + path;
}

/** 0xRRGGBB -> "#rrggbb", para onde o Phaser/CSS pede string. */
export function numberToCss(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}
