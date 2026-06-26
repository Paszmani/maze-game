import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Direction } from '../direction.js';
import {
  Ghost,
  chaseTarget,
  chooseDirection,
  chooseFrightenedDirection,
  shouldReverse,
  type ChaseContext,
  type Rng,
} from '../ghost-ai.js';

/** Sala aberta 5x5; interior caminhavel em x,y de 1..3. */
const ROOM = ['#####', '#...#', '#...#', '#...#', '#####'];
const room = () => Maze.fromAscii(ROOM);

/** RNG determinístico que consome uma fila de valores. */
const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
};

const ctx = (over: Partial<ChaseContext> = {}): ChaseContext => ({
  pacman: { x: 3, y: 3 },
  pacmanDir: Direction.Right,
  blinky: { x: 1, y: 1 },
  ...over,
});

describe('chaseTarget — personalidades', () => {
  const ghost = { position: { x: 0, y: 0 }, scatterCorner: { x: 99, y: 99 } };

  it('blinky mira a celula do Pac-Man', () => {
    expect(chaseTarget('blinky', ghost, ctx({ pacman: { x: 5, y: 5 } }))).toEqual({ x: 5, y: 5 });
  });

  it('pinky mira 4 celulas a frente', () => {
    const t = chaseTarget('pinky', ghost, ctx({ pacman: { x: 5, y: 5 }, pacmanDir: Direction.Right }));
    expect(t).toEqual({ x: 9, y: 5 });
  });

  it('inky espelha o vetor do blinky 2 celulas a frente', () => {
    // pivot = (5,5) + 2*Right = (7,5); alvo = 2*pivot - blinky(1,1) = (13,9)
    const t = chaseTarget('inky', ghost, ctx({ pacman: { x: 5, y: 5 }, pacmanDir: Direction.Right, blinky: { x: 1, y: 1 } }));
    expect(t).toEqual({ x: 13, y: 9 });
  });

  it('clyde persegue quando longe (>8)', () => {
    const far = { position: { x: 0, y: 0 }, scatterCorner: { x: 99, y: 99 } };
    expect(chaseTarget('clyde', far, ctx({ pacman: { x: 10, y: 0 } }))).toEqual({ x: 10, y: 0 });
  });

  it('clyde recua para o canto quando perto (<=8)', () => {
    const near = { position: { x: 5, y: 5 }, scatterCorner: { x: 99, y: 99 } };
    expect(chaseTarget('clyde', near, ctx({ pacman: { x: 6, y: 5 } }))).toEqual({ x: 99, y: 99 });
  });
});

describe('chooseDirection — decisao greedy', () => {
  it('escolhe a saida mais proxima do alvo', () => {
    const m = room();
    // de (2,2), alvo bem a direita: a celula (3,2) e a mais proxima
    expect(chooseDirection(m, { x: 2, y: 2 }, Direction.None, { x: 10, y: 2 })).toBe(Direction.Right);
  });

  it('desempata pela ordem cima > esquerda > baixo > direita', () => {
    const m = room();
    // alvo em (10,10): (3,2) e (2,3) empatam; preferencia escolhe Down antes de Right
    expect(chooseDirection(m, { x: 2, y: 2 }, Direction.None, { x: 10, y: 10 })).toBe(Direction.Down);
  });

  it('nunca da meia-volta, mesmo que a reversao fosse o melhor caminho', () => {
    const m = room();
    // movendo para a direita, alvo a esquerda: Left seria o melhor, mas e proibido.
    // Restam Up/Down (empate) -> Up por preferencia.
    expect(chooseDirection(m, { x: 2, y: 2 }, Direction.Right, { x: -10, y: 2 })).toBe(Direction.Up);
  });

  it('permite meia-volta em beco sem saida', () => {
    const m = Maze.fromAscii(['###', '#.#', '#.#', '#.#', '###']); // corredor vertical x=1
    // em (1,3) descendo, baixo e parede; unica saida e voltar (Up), mesmo com alvo abaixo
    expect(chooseDirection(m, { x: 1, y: 3 }, Direction.Down, { x: 1, y: 10 })).toBe(Direction.Up);
  });

  it('retorna None quando encurralado', () => {
    const m = Maze.fromAscii(['###', '#.#', '###']);
    expect(chooseDirection(m, { x: 1, y: 1 }, Direction.None, { x: 0, y: 0 })).toBe(Direction.None);
  });
});

describe('chooseFrightenedDirection — aleatorio determinístico', () => {
  it('mapeia o RNG para a saida na ordem de preferencia', () => {
    const m = room();
    expect(chooseFrightenedDirection(m, { x: 2, y: 2 }, Direction.None, seq([0]))).toBe(Direction.Up);
    expect(chooseFrightenedDirection(m, { x: 2, y: 2 }, Direction.None, seq([0.99]))).toBe(Direction.Right);
    expect(chooseFrightenedDirection(m, { x: 2, y: 2 }, Direction.None, seq([0.5]))).toBe(Direction.Down);
  });

  it('exclui a meia-volta tambem no modo frightened', () => {
    const m = room();
    // movendo para a direita: candidatos [Up, Down, Right]; rng 0 -> Up
    expect(chooseFrightenedDirection(m, { x: 2, y: 2 }, Direction.Right, seq([0]))).toBe(Direction.Up);
  });
});

describe('shouldReverse — regra de meia-volta forcada', () => {
  it('inverte entre scatter e chase', () => {
    expect(shouldReverse('scatter', 'chase')).toBe(true);
    expect(shouldReverse('chase', 'scatter')).toBe(true);
  });

  it('inverte ao entrar em frightened (vindo de scatter/chase)', () => {
    expect(shouldReverse('chase', 'frightened')).toBe(true);
    expect(shouldReverse('scatter', 'frightened')).toBe(true);
  });

  it('NAO inverte quando o frightened termina', () => {
    expect(shouldReverse('frightened', 'chase')).toBe(false);
    expect(shouldReverse('frightened', 'scatter')).toBe(false);
  });

  it('NAO inverte em transicoes envolvendo eaten', () => {
    expect(shouldReverse('chase', 'eaten')).toBe(false);
    expect(shouldReverse('eaten', 'chase')).toBe(false);
  });
});

describe('Ghost', () => {
  const make = (over: Partial<ConstructorParameters<typeof Ghost>[0]> = {}) =>
    new Ghost({
      personality: 'blinky',
      position: { x: 1, y: 1 },
      scatterCorner: { x: 99, y: 0 },
      homeTarget: { x: 2, y: 2 },
      direction: Direction.Right,
      mode: 'scatter',
      ...over,
    });

  it('setMode aplica a meia-volta quando a regra manda', () => {
    const g = make({ direction: Direction.Right, mode: 'scatter' });
    g.setMode('chase');
    expect(g.direction).toBe(Direction.Left);
    expect(g.mode).toBe('chase');
  });

  it('setMode nao inverte ao sair do frightened', () => {
    const g = make({ direction: Direction.Right, mode: 'frightened' });
    g.setMode('chase');
    expect(g.direction).toBe(Direction.Right);
  });

  it('target reflete o modo', () => {
    expect(make({ mode: 'scatter' }).target(ctx())).toEqual({ x: 99, y: 0 });
    expect(make({ mode: 'eaten' }).target(ctx())).toEqual({ x: 2, y: 2 });
    expect(make({ mode: 'chase', personality: 'blinky' }).target(ctx({ pacman: { x: 3, y: 3 } }))).toEqual({ x: 3, y: 3 });
    expect(make({ mode: 'frightened' }).target(ctx())).toBeNull();
  });

  it('update em chase se aproxima do Pac-Man', () => {
    const m = room();
    const g = make({ position: { x: 1, y: 1 }, direction: Direction.None, mode: 'chase' });
    const rng = seq([0]);
    g.update(m, ctx({ pacman: { x: 3, y: 3 } }), rng);
    // de (1,1) rumo a (3,3): Down e Right empatam -> Down por preferencia
    expect(g.position).toEqual({ x: 1, y: 2 });
    g.update(m, ctx({ pacman: { x: 3, y: 3 } }), rng);
    // de (1,2): Right(2,2)->2  vs Down(1,3)->4 -> Right
    expect(g.position).toEqual({ x: 2, y: 2 });
  });

  it('update em frightened usa o RNG e respeita o grid', () => {
    const m = room();
    const g = make({ position: { x: 2, y: 2 }, direction: Direction.None, mode: 'frightened' });
    g.update(m, ctx(), seq([0])); // Up
    expect(g.position).toEqual({ x: 2, y: 1 });
  });
});
