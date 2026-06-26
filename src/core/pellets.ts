/**
 * Estado dos pellets e power-pellets — quais celulas ainda tem o que comer.
 *
 * Separado do labirinto de proposito: a geometria (paredes/tuneis) nao muda
 * durante a partida, mas os pellets somem conforme sao comidos. Guarda um
 * snapshot inicial para que `reset()` reabasteca numa nova partida sem precisar
 * reparsear nada.
 */

import { type Vec2 } from './direction.js';

export type PelletKind = 'pellet' | 'power' | 'none';

const key = (x: number, y: number): string => `${x},${y}`;

export class Pellets {
  private pellets: Set<string>;
  private power: Set<string>;
  private readonly initialPellets: ReadonlySet<string>;
  private readonly initialPower: ReadonlySet<string>;

  constructor(pellets: Iterable<Vec2>, power: Iterable<Vec2>) {
    this.pellets = new Set([...pellets].map((p) => key(p.x, p.y)));
    this.power = new Set([...power].map((p) => key(p.x, p.y)));
    this.initialPellets = new Set(this.pellets);
    this.initialPower = new Set(this.power);
  }

  /**
   * Le um layout ASCII: '.' = pellet, 'o'/'O' = power-pellet. Demais caracteres
   * (paredes, espacos, tuneis) sao ignorados. Combina com a mesma string usada
   * pelo Maze, ja que pellets so existem em celulas caminhaveis.
   */
  static fromAscii(rows: string[]): Pellets {
    const pellets: Vec2[] = [];
    const power: Vec2[] = [];
    rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        if (char === '.') pellets.push({ x, y });
        else if (char === 'o' || char === 'O') power.push({ x, y });
      });
    });
    return new Pellets(pellets, power);
  }

  hasPellet(x: number, y: number): boolean {
    return this.pellets.has(key(x, y));
  }

  hasPowerPellet(x: number, y: number): boolean {
    return this.power.has(key(x, y));
  }

  /** Come o que houver na celula e remove. Power tem prioridade se coexistirem. */
  consume(x: number, y: number): PelletKind {
    const k = key(x, y);
    if (this.power.delete(k)) return 'power';
    if (this.pellets.delete(k)) return 'pellet';
    return 'none';
  }

  remaining(): number {
    return this.pellets.size + this.power.size;
  }

  isCleared(): boolean {
    return this.remaining() === 0;
  }

  /** Reabastece para o estado inicial — nova partida. */
  reset(): void {
    this.pellets = new Set(this.initialPellets);
    this.power = new Set(this.initialPower);
  }
}
