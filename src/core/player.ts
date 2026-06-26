/**
 * Movimento do personagem no grid.
 *
 * Modela a sensacao classica de Pac-Man com um unico mecanismo: alem da direcao
 * atual, o jogador guarda uma direcao *desejada* (o ultimo input). A cada passo,
 * tenta primeiro virar para a desejada; se a curva ainda nao e possivel, segue
 * reto e mantem a desejada em buffer para virar assim que chegar na esquina.
 * Isso permite "pre-virar" — deslizar antes de alcancar o corredor.
 *
 * Posicao e sempre em celulas inteiras. A interpolacao suave entre celulas e
 * problema do render (Phaser), nao do core.
 */

import { Direction, type Vec2 } from './direction.js';
import type { Maze } from './maze.js';

export class Player {
  position: Vec2;
  /** Direcao em que o jogador esta efetivamente se movendo. */
  direction: Direction;
  /** Ultimo input do jogador, mantido ate ser consumido por uma curva valida. */
  desired: Direction;

  constructor(start: Vec2, direction: Direction = Direction.None) {
    this.position = start;
    this.direction = direction;
    this.desired = Direction.None;
  }

  /** Registra a intencao do jogador. Nao move nada — so bufferiza o input. */
  queue(direction: Direction): void {
    this.desired = direction;
  }

  /**
   * Avanca uma celula. Prioridade:
   *   1. virar para `desired` se for caminhavel (consome a curva, mantem o buffer);
   *   2. senao, continuar na `direction` atual se possivel;
   *   3. senao, parar (mantem a direcao apontada para a parede, posicao inalterada).
   *
   * Retorna `true` se a posicao mudou neste passo.
   */
  update(maze: Maze): boolean {
    if (this.desired !== Direction.None) {
      const turned = maze.step(this.position, this.desired);
      if (turned) {
        this.direction = this.desired;
        this.position = turned;
        return true;
      }
    }

    if (this.direction !== Direction.None) {
      const ahead = maze.step(this.position, this.direction);
      if (ahead) {
        this.position = ahead;
        return true;
      }
    }

    return false;
  }
}
