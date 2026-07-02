/**
 * Monitor de inatividade (modulo 7). Regra de totem: sem toque por ~30s em
 * qualquer tela, volta para o attract — o totem nunca pode ficar "preso".
 *
 * Auto-registra listeners de toque/tecla na cena para zerar o cronometro a cada
 * interacao. `update()` (chamado no loop da cena) dispara `onIdle` uma vez quando
 * o tempo ocioso estoura. Desacoplado: nao sabe para onde vai — so avisa.
 */

import Phaser from 'phaser';

export class InactivityMonitor {
  private readonly scene: Phaser.Scene;
  private readonly timeoutMs: number;
  private readonly onIdle: () => void;
  private lastActivity: number;
  private fired = false;
  // O relogio da cena (`time.now`) pode estar defasado em `create()`. So confiamos
  // nele a partir da primeira `update()`, quando ja avancou — senao um `lastActivity`
  // defasado dispararia o idle IMEDIATAMENTE (fazia a LeadScene "piscar e sumir").
  private primed = false;

  constructor(scene: Phaser.Scene, timeoutMs: number, onIdle: () => void) {
    this.scene = scene;
    this.timeoutMs = timeoutMs;
    this.onIdle = onIdle;
    this.lastActivity = scene.time.now;

    scene.input.on('pointerdown', this.reset, this);
    scene.input.keyboard?.on('keydown', this.reset, this);
  }

  reset(): void {
    this.lastActivity = this.scene.time.now;
    this.fired = false;
    this.primed = true;
  }

  update(): void {
    if (this.fired) return;
    const now = this.scene.time.now;
    // Primeira atualizacao real: fixa a base e nao dispara (evita o falso idle).
    if (!this.primed) {
      this.primed = true;
      this.lastActivity = now;
      return;
    }
    if (now - this.lastActivity >= this.timeoutMs) {
      this.fired = true;
      this.onIdle();
    }
  }
}

/** Lê `?idle=<ms>` para tuning; cai no default se ausente/invalido. */
export function inactivityMs(defaultMs: number): number {
  const raw = Number(new URLSearchParams(window.location.search).get('idle'));
  return Number.isFinite(raw) && raw > 0 ? raw : defaultMs;
}
