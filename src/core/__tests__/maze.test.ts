import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Direction } from '../direction.js';

/**
 * Labirinto de teste (5x5):
 *   y0: #####
 *   y1: #...#
 *   y2: #.#.#
 *   y3: T...T   <- linha de tunel: bordas em (0,3) e (4,3)
 *   y4: #####
 */
const ASCII = ['#####', '#...#', '#.#.#', 'T...T', '#####'];
const maze = () => Maze.fromAscii(ASCII);

describe('Maze.fromAscii', () => {
  it('le dimensoes corretas', () => {
    const m = maze();
    expect(m.width).toBe(5);
    expect(m.height).toBe(5);
  });

  it('rejeita grid nao retangular', () => {
    expect(() => Maze.fromAscii(['###', '##'])).toThrow(/retangular/);
  });

  it('rejeita grid vazio', () => {
    expect(() => Maze.fromAscii([])).toThrow();
    expect(() => new Maze([])).toThrow();
  });
});

describe('Maze.tile queries', () => {
  it('classifica parede, caminho e tunel', () => {
    const m = maze();
    expect(m.isWall(0, 0)).toBe(true);
    expect(m.isWall(1, 1)).toBe(false);
    expect(m.isWall(2, 2)).toBe(true); // o '#' interno em y2
    expect(m.isTunnel(0, 3)).toBe(true);
    expect(m.isTunnel(4, 3)).toBe(true);
    expect(m.isWalkable(1, 1)).toBe(true);
    expect(m.isWalkable(0, 3)).toBe(true); // tunel e caminhavel
  });

  it('trata fora-dos-limites como parede', () => {
    const m = maze();
    expect(m.tileAt(-1, 0)).toBe('wall');
    expect(m.tileAt(0, 99)).toBe('wall');
    expect(m.isWalkable(-1, 3)).toBe(false);
  });
});

describe('Maze.step', () => {
  it('avanca para celula livre', () => {
    const m = maze();
    expect(m.step({ x: 1, y: 1 }, Direction.Right)).toEqual({ x: 2, y: 1 });
  });

  it('bloqueia contra parede', () => {
    const m = maze();
    expect(m.step({ x: 1, y: 1 }, Direction.Up)).toBeNull(); // y0 e parede
    expect(m.step({ x: 1, y: 1 }, Direction.Left)).toBeNull(); // x0 e parede
  });

  it('retorna null para Direction.None', () => {
    const m = maze();
    expect(m.step({ x: 1, y: 1 }, Direction.None)).toBeNull();
  });

  it('faz wrap pelo tunel da borda esquerda para a direita', () => {
    const m = maze();
    expect(m.step({ x: 0, y: 3 }, Direction.Left)).toEqual({ x: 4, y: 3 });
  });

  it('faz wrap pelo tunel da borda direita para a esquerda', () => {
    const m = maze();
    expect(m.step({ x: 4, y: 3 }, Direction.Right)).toEqual({ x: 0, y: 3 });
  });

  it('nao faz wrap a partir de celula que nao e tunel', () => {
    // (1,1) e caminho normal; sair pela borda de cima nao deveria existir aqui,
    // mas garantimos que wrap nao acontece fora de tunel: borda superior e parede.
    const m = maze();
    expect(m.step({ x: 1, y: 1 }, Direction.Up)).toBeNull();
  });

  it('nao faz wrap vertical, mesmo em tunel', () => {
    const m = maze();
    // de (0,3) tunel indo para cima: (0,2) e parede -> null, nao wrap vertical
    expect(m.step({ x: 0, y: 3 }, Direction.Up)).toBeNull();
  });
});
