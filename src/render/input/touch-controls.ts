/**
 * Controles de toque (modulo 5): SWIPE em qualquer ponto da tela — deslizar o
 * dedo em qualquer canto vira o player naquela direcao. Opcionalmente, um d-pad
 * on-screen (setas) como reforco — ligado so no Android (`showDpad`).
 *
 * O swipe dispara DURANTE o arraste (no `pointermove`), assim que cruza o limiar,
 * e "re-arma" no ponto atual: um unico movimento continuo encadeia varias viradas.
 *
 * Desacoplado: nao conhece Player nem regra de jogo. Recebe `onDirection(dir)` e
 * so traduz gesto -> direcao. A GameScene liga isso ao core.
 */

import Phaser from 'phaser';
import { Direction } from '../../core/direction.js';

export type DirectionHandler = (dir: Direction) => void;

export interface TouchControlsOptions {
  /** Deslocamento minimo (px) para um arrasto contar como swipe. */
  swipeThreshold?: number;
  /** Mostra o d-pad on-screen (setas). Ligado so no Android. */
  showDpad?: boolean;
}

const ARROW: Readonly<Record<Direction, string>> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
  none: '',
};

export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly onDirection: DirectionHandler;
  private readonly swipeThreshold: number;

  private startX = 0;
  private startY = 0;
  private tracking = false;

  constructor(scene: Phaser.Scene, onDirection: DirectionHandler, options: TouchControlsOptions = {}) {
    this.scene = scene;
    this.onDirection = onDirection;
    this.swipeThreshold = options.swipeThreshold ?? 24;

    this.bindSwipe();
    if (options.showDpad) this.buildDpad();
  }

  private bindSwipe(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startX = pointer.x;
      this.startY = pointer.y;
      this.tracking = true;
    });

    // Durante o arraste: ao cruzar o limiar, dispara e re-arma no ponto atual.
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.tracking || !pointer.isDown) return;
      const dir = this.resolveSwipe(pointer.x - this.startX, pointer.y - this.startY);
      if (dir !== Direction.None) {
        this.onDirection(dir);
        this.startX = pointer.x;
        this.startY = pointer.y;
      }
    });

    // Ao soltar: resolve um flick curto que nao chegou a disparar no move.
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.tracking) return;
      this.tracking = false;
      const dir = this.resolveSwipe(pointer.x - this.startX, pointer.y - this.startY);
      if (dir !== Direction.None) this.onDirection(dir);
    });
  }

  /** Eixo dominante decide a direcao; abaixo do limiar e toque (ignora). */
  private resolveSwipe(dx: number, dy: number): Direction {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.swipeThreshold) return Direction.None;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? Direction.Right : Direction.Left;
    return dy > 0 ? Direction.Down : Direction.Up;
  }

  // --- D-pad on-screen (Android) -----------------------------------------

  private buildDpad(): void {
    const size = 58;
    const alpha = 0.28;
    const cx = this.scene.scale.width - size * 1.9;
    const cy = this.scene.scale.height - size * 1.9;
    const gap = size * 1.05;
    this.makeButton(cx, cy - gap, Direction.Up, size, alpha);
    this.makeButton(cx, cy + gap, Direction.Down, size, alpha);
    this.makeButton(cx - gap, cy, Direction.Left, size, alpha);
    this.makeButton(cx + gap, cy, Direction.Right, size, alpha);
  }

  private makeButton(x: number, y: number, dir: Direction, size: number, alpha: number): void {
    this.scene.add
      .rectangle(x, y, size, size, 0xffffff, alpha)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onDirection(dir));

    this.scene.add
      .text(x, y, ARROW[dir], { fontFamily: 'monospace', fontSize: `${Math.round(size * 0.55)}px`, color: '#000000' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);
  }
}
