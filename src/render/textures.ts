/**
 * Chaves de textura compartilhadas entre PreloadScene (carrega) e as cenas
 * (consomem). Centralizado para nao haver string solta divergindo entre arquivos.
 */

import type { Personality } from '../core/ghost-ai.js';

export const GHOSTS: ReadonlyArray<Personality> = ['blinky', 'pinky', 'inky', 'clyde'];

export const TEX = {
  player: 'sprite-player',
  pellet: 'sprite-pellet',
  power: 'sprite-power',
  frightened: 'sprite-frightened',
  fruit: 'sprite-fruit',
  ghost: (p: Personality): string => `sprite-ghost-${p}`,
  mazeBg: 'sprite-maze-bg',
  attractBg: 'sprite-attract-bg',
  logo: 'sprite-logo',
} as const;
