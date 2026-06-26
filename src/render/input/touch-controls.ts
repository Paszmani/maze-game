/**
 * Controles de toque para o totem (modulo 5): swipe como principal, d-pad
 * on-screen como reforco. Conforme a UX de kiosk — Pac-Man e direcional, deslizar
 * e natural; o d-pad cobre quem prefere tocar botao.
 *
 * Desacoplado de proposito: nao conhece Player nem regra de jogo. Recebe um
 * callback `onDirection(dir)` e so traduz gesto -> direcao. Quem liga isso ao
 * core e a GameScene.
 */

import Phaser from 'phaser';
import { Direction } from '../../core/direction.js';

export type DirectionHandler = (dir: Direction) => void;

export interface TouchControlsOptions {
  /** Deslocamento minimo (px) para um arrasto contar como swipe. */
  swipeThreshold?: number;
  /** Centro do d-pad em coordenadas da cena. */
  dpadCenter?: { x: number; y: number };
  /** Lado de cada botao (px). UX de totem pede alvos grandes. */
  dpadButtonSize?: number;
  dpadAlpha?: number;
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
    this.buildDpad(options);
  }

  // --- Swipe (gesto em qualquer ponto da tela) ---------------------------

  private bindSwipe(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startX = pointer.x;
      this.startY = pointer.y;
      this.tracking = true;
    });

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

  // --- D-pad on-screen ---------------------------------------------------

  private buildDpad(options: TouchControlsOptions): void {
    const size = options.dpadButtonSize ?? 56;
    const alpha = options.dpadAlpha ?? 0.3;
    const center = options.dpadCenter ?? {
      x: this.scene.scale.width - size * 1.9,
      y: this.scene.scale.height - size * 1.9,
    };
    const gap = size * 1.05;

    this.makeButton(center.x, center.y - gap, Direction.Up, size, alpha);
    this.makeButton(center.x, center.y + gap, Direction.Down, size, alpha);
    this.makeButton(center.x - gap, center.y, Direction.Left, size, alpha);
    this.makeButton(center.x + gap, center.y, Direction.Right, size, alpha);
  }

  private makeButton(x: number, y: number, dir: Direction, size: number, alpha: number): void {
    const button = this.scene.add
      .rectangle(x, y, size, size, 0xffffff, alpha)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => this.onDirection(dir));

    this.scene.add
      .text(x, y, ARROW[dir], { fontFamily: 'monospace', fontSize: `${Math.round(size * 0.55)}px`, color: '#000000' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);
  }
}
