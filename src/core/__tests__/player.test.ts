import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Player } from '../player.js';
import { Direction } from '../direction.js';

/**
 *   y0: #####
 *   y1: #...#
 *   y2: #.#.#
 *   y3: T...T
 *   y4: #####
 */
const ASCII = ['#####', '#...#', '#.#.#', 'T...T', '#####'];
const maze = () => Maze.fromAscii(ASCII);

describe('Player.update — movimento basico', () => {
  it('parado sem direcao nem desejo nao se move', () => {
    const m = maze();
    const p = new Player({ x: 1, y: 1 });
    expect(p.update(m)).toBe(false);
    expect(p.position).toEqual({ x: 1, y: 1 });
  });

  it('move-se na direcao desejada e adota como direcao atual', () => {
    const m = maze();
    const p = new Player({ x: 1, y: 1 });
    p.queue(Direction.Right);
    expect(p.update(m)).toBe(true);
    expect(p.position).toEqual({ x: 2, y: 1 });
    expect(p.direction).toBe(Direction.Right);
  });

  it('continua na direcao atual sem novo input', () => {
    const m = maze();
    const p = new Player({ x: 1, y: 1 }, Direction.Right);
    p.update(m);
    expect(p.position).toEqual({ x: 2, y: 1 });
    p.update(m);
    expect(p.position).toEqual({ x: 3, y: 1 });
  });

  it('para ao bater na parede e mantem a direcao apontada', () => {
    const m = maze();
    const p = new Player({ x: 3, y: 1 }, Direction.Right); // x4 e parede
    expect(p.update(m)).toBe(false);
    expect(p.position).toEqual({ x: 3, y: 1 });
    expect(p.direction).toBe(Direction.Right);
  });
});

describe('Player.update — buffer de curva (pre-virar)', () => {
  it('mantem a desejada ate a esquina e entao vira', () => {
    const m = maze();
    // Em (1,1) indo para a direita; jogador ja quer descer.
    // (1,2) e caminho, entao pode descer ja em (1,1)? Nao: de (1,1) para baixo -> (1,2) e caminho.
    const p = new Player({ x: 1, y: 1 }, Direction.Right);
    p.queue(Direction.Down);
    // de (1,1), baixo -> (1,2) caminhavel: vira imediatamente
    expect(p.update(m)).toBe(true);
    expect(p.position).toEqual({ x: 1, y: 2 });
    expect(p.direction).toBe(Direction.Down);
  });

  it('segue reto quando a curva ainda nao e possivel, depois vira', () => {
    const m = maze();
    // Em (1,3) indo para a direita, querendo subir.
    // (1,2) e caminho -> na verdade pode subir. Use coluna 2: (2,2) e parede.
    // Em (1,3) -> cima (1,2) caminho. Escolha um ponto onde cima e bloqueado:
    // (2,3) -> cima (2,2) e parede. Indo direita, querendo subir:
    const p = new Player({ x: 2, y: 3 }, Direction.Right);
    p.queue(Direction.Up);
    // cima bloqueado em (2,3): segue reto para (3,3)
    expect(p.update(m)).toBe(true);
    expect(p.position).toEqual({ x: 3, y: 3 });
    expect(p.direction).toBe(Direction.Right);
    // em (3,3): cima (3,2) e caminho -> agora vira para cima
    expect(p.update(m)).toBe(true);
    expect(p.position).toEqual({ x: 3, y: 2 });
    expect(p.direction).toBe(Direction.Up);
  });
});

describe('Player.update — tunel', () => {
  it('atravessa o tunel via wrap horizontal', () => {
    const m = maze();
    const p = new Player({ x: 1, y: 3 }, Direction.Left);
    p.update(m); // (1,3) -> (0,3) tunel
    expect(p.position).toEqual({ x: 0, y: 3 });
    p.update(m); // (0,3) -> wrap -> (4,3)
    expect(p.position).toEqual({ x: 4, y: 3 });
    expect(p.direction).toBe(Direction.Left);
  });
});
