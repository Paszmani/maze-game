import { describe, it, expect } from 'vitest';
import { Maze } from '../../core/maze.js';
import { Pellets } from '../../core/pellets.js';
import { Direction, type Vec2 } from '../../core/direction.js';
import {
  MAZE_LAYOUT,
  POWER,
  PLAYER_SPAWN,
  FRUIT_POSITIONS,
  GHOST_SPAWNS,
  HOUSE_INTERIOR,
  HOUSE_DOOR,
  HOUSE_EXIT,
} from '../maze-layout.js';

/**
 * O labirinto e escrito a mao — este teste e a rede de seguranca contra erros de
 * autoria (pellet ilhado, corredor sem saida, porta no lugar errado). Faz
 * flood-fill do spawn pelo passo COMUM (sem atravessar a porta) e exige que tudo
 * que importa seja alcancavel.
 */

const maze = () => Maze.fromAscii([...MAZE_LAYOUT]);
const pellets = () => Pellets.fromAscii([...MAZE_LAYOUT]);
const key = (v: Vec2) => `${v.x},${v.y}`;

/** Celulas alcancaveis do spawn pelo passo comum (respeita paredes/tuneis, nao a porta). */
function reachable(): Set<string> {
  const m = maze();
  const seen = new Set<string>([key(PLAYER_SPAWN)]);
  const queue: Vec2[] = [PLAYER_SPAWN];
  const dirs = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const d of dirs) {
      const n = m.step(cur, d);
      if (n && !seen.has(key(n))) {
        seen.add(key(n));
        queue.push(n);
      }
    }
  }
  return seen;
}

describe('maze-layout — estrutura', () => {
  it('todas as linhas tem a mesma largura (grade retangular)', () => {
    const w = MAZE_LAYOUT[0]!.length;
    for (const row of MAZE_LAYOUT) expect(row.length).toBe(w);
    expect(w).toBe(28);
    expect(MAZE_LAYOUT.length).toBe(31);
  });

  it('mantem exatamente 4 power-pellets', () => {
    expect(POWER.length).toBe(4);
  });

  it('a porta e reconhecida e a saida fica logo acima dela', () => {
    const m = maze();
    expect(m.isDoor(HOUSE_DOOR.x, HOUSE_DOOR.y)).toBe(true);
    expect(HOUSE_EXIT).toEqual({ x: HOUSE_DOOR.x, y: HOUSE_DOOR.y - 1 });
    expect(m.isWalkable(HOUSE_EXIT.x, HOUSE_EXIT.y)).toBe(true);
  });

  it('o interior da casa e caminhavel e sem pellets', () => {
    const m = maze();
    const p = pellets();
    for (const c of HOUSE_INTERIOR) {
      expect(m.isWalkable(c.x, c.y), `interior (${c.x},${c.y}) deveria ser caminhavel`).toBe(true);
      expect(p.hasPellet(c.x, c.y)).toBe(false);
      expect(p.hasPowerPellet(c.x, c.y)).toBe(false);
    }
  });
});

describe('maze-layout — conectividade (flood-fill do spawn)', () => {
  const reach = reachable();

  it('o spawn do jogador e caminhavel', () => {
    expect(maze().isWalkable(PLAYER_SPAWN.x, PLAYER_SPAWN.y)).toBe(true);
  });

  it('todo pellet e power-pellet e alcancavel do spawn', () => {
    const m = maze();
    const p = pellets();
    const unreachable: string[] = [];
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if ((p.hasPellet(x, y) || p.hasPowerPellet(x, y)) && !reach.has(`${x},${y}`)) {
          unreachable.push(`${x},${y}`);
        }
      }
    }
    expect(unreachable, `pellets ilhados: ${unreachable.join(' ')}`).toEqual([]);
  });

  it('a saida da casa dos fantasmas e alcancavel do spawn', () => {
    expect(reach.has(key(HOUSE_EXIT))).toBe(true);
  });

  it('cada posicao de fruta e alcancavel do spawn', () => {
    for (const f of FRUIT_POSITIONS) {
      expect(reach.has(key(f)), `fruta (${f.x},${f.y}) ilhada`).toBe(true);
    }
  });

  it('os spawns dos fantasmas estao na casa ou sao alcancaveis', () => {
    const inHouse = new Set(HOUSE_INTERIOR.map(key));
    for (const g of GHOST_SPAWNS) {
      const ok = inHouse.has(key(g.position)) || reach.has(key(g.position));
      expect(ok, `${g.personality} spawn (${g.position.x},${g.position.y}) invalido`).toBe(true);
    }
  });

  it('os cantos de scatter sao alcancaveis (senao a IA nunca chega la)', () => {
    for (const g of GHOST_SPAWNS) {
      expect(reach.has(key(g.scatterCorner)), `${g.personality} scatterCorner ilhado`).toBe(true);
    }
  });
});
