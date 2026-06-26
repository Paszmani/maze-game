/**
 * Constantes de render (pixels e cores). Provisorias ate o sistema de tema
 * (modulo 6) — quando ele existir, estas cores virao do theme.json e este
 * arquivo so guarda o que e estrutural (tamanho de tile, altura do HUD).
 */

import type { Personality } from '../core/ghost-ai.js';

export const TILE = 24;
export const HUD_HEIGHT = 48;

export const COLORS = {
  wall: 0x1b3a8f,
  pellet: 0xffffff,
  power: 0xffcc00,
  player: 0xffcc00,
  frightened: 0x2233ff,
  eaten: 0x556699,
  text: '#ffffff',
} as const;

export const GHOST_COLORS: Readonly<Record<Personality, number>> = {
  blinky: 0xff0000,
  pinky: 0xff66cc,
  inky: 0x00ffff,
  clyde: 0xff9900,
};
