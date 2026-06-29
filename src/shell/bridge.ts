/**
 * Ponte renderer <-> Electron (modulo 9). O preload do Electron expoe `window.kiosk`
 * com esta forma; no browser puro ela e `undefined` e o jogo usa os caminhos web
 * (fetch de tema, localStorage de lead). Feature-detection via `getKiosk()`.
 */

import type { Lead } from '../data/lead-store.js';

export interface KioskConfig {
  terminalId: string;
  themeId: string;
}

export interface KioskBridge {
  isKiosk: boolean;
  getConfig(): Promise<KioskConfig>;
  /** Tema lido do disco, com sprites ja embutidos como data-URI. */
  loadTheme(): Promise<unknown>;
  /** Grava o tema (do editor) no disco e aponta o config para ele. */
  saveTheme(theme: unknown): Promise<{ ok: boolean; id: string }>;
  saveLead(lead: Lead): Promise<void>;
  /** Abre a pasta de leads no explorador (para o operador copiar/exportar). */
  revealLeads(): Promise<void>;
}

declare global {
  interface Window {
    kiosk?: KioskBridge;
  }
}

export function getKiosk(): KioskBridge | undefined {
  return window.kiosk;
}
