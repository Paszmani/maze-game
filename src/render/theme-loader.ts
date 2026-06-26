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

/** 0xRRGGBB -> "#rrggbb", para onde o Phaser/CSS pede string. */
export function numberToCss(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}
