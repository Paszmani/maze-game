/**
 * Tema de fallback — completo e sempre valido. Todo campo ausente ou malformado
 * em um theme.json cai para o valor correspondente daqui (ver `resolveTheme`).
 * Sao as mesmas cores que o render usava hardcoded antes do sistema de tema.
 */

import type { Theme } from './theme-schema.js';

export const DEFAULT_THEME: Theme = {
  id: 'default',
  name: 'Default',
  colors: {
    maze: 0x1b3a8f,
    background: 0x000010,
    pellet: 0xffffff,
    power: 0xffcc00,
    player: 0xffcc00,
    frightened: 0x2233ff,
    eaten: 0x556699,
    uiAccent: 0xe30613,
    text: '#ffffff',
    ghosts: {
      blinky: 0xff0000,
      pinky: 0xff66cc,
      inky: 0x00ffff,
      clyde: 0xff9900,
    },
  },
  branding: {
    attractHeadline: 'DESVIE. COLETE. VENÇA.',
    ctaButton: 'TOCAR PARA JOGAR',
    leadHeadline: 'Cadastre-se e concorra a um brinde!',
    logo: null,
  },
  gameplay: {
    playerSpeed: 1.0,
    ghostSpeed: 0.9,
    powerDurationMs: 6000,
  },
  sprites: {
    player: null,
    pellet: null,
    powerPellet: null,
    ghosts: [],
  },
  audio: {
    chomp: null,
    powerup: null,
    gameover: null,
  },
  leadForm: {
    fields: [
      { id: 'name', label: 'Nome', type: 'text', required: true, maxLength: 60 },
      { id: 'email', label: 'E-mail', type: 'email', required: true },
    ],
  },
};
