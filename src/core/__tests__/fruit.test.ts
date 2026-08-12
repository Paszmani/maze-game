import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Pellets } from '../pellets.js';
import { Player } from '../player.js';
import { GameState, type GameConfig } from '../game-state.js';
import { Direction, type Vec2 } from '../direction.js';

// Corredor: '#....#' -> pellets em x1..4 (a celula inicial x1 nao e comida se parado).
const ROWS = ['######', '#....#', '######'];
const STEP: Partial<GameConfig> = { baseStepMs: 100, playerSpeed: 1 };

function build(cfg: Partial<GameConfig>, dir: Direction = Direction.None): GameState {
  const rows = [...ROWS];
  return new GameState({
    maze: Maze.fromAscii(rows),
    pellets: Pellets.fromAscii(rows),
    player: new Player({ x: 1, y: 1 }, dir),
    ghosts: [],
    config: { ...STEP, ...cfg },
  });
}

const at = (v: Vec2): Partial<GameConfig> => ({ fruitPositions: [v] });

describe('Fruta — efeito de power-pellet (fruitAsPower)', () => {
  it('com fruitAsPower, comer a fruta dispara o frightened', () => {
    const gs = build(
      { ...at({ x: 4, y: 1 }), fruitSpawnIntervalMs: 100, fruitDurationMs: 10_000, fruitAsPower: true, powerDurationMs: 5_000 },
      Direction.Right,
    );
    gs.start();
    for (let i = 0; i < 3; i++) gs.tick(100); // chega em (4,1) e come a fruta
    expect(gs.isFrightened).toBe(true);
  });

  it('sem fruitAsPower (padrao), comer a fruta NAO dispara o frightened', () => {
    const gs = build(
      { ...at({ x: 4, y: 1 }), fruitSpawnIntervalMs: 100, fruitDurationMs: 10_000, powerDurationMs: 5_000 },
      Direction.Right,
    );
    gs.start();
    for (let i = 0; i < 3; i++) gs.tick(100);
    expect(gs.isFrightened).toBe(false);
  });
});

describe('Fruta — spawn periodico', () => {
  it('aparece ao cruzar o intervalo de spawn', () => {
    const gs = build({ ...at({ x: 4, y: 1 }), fruitSpawnIntervalMs: 300, fruitDurationMs: 10_000 });
    gs.start();
    for (let i = 0; i < 2; i++) gs.tick(100); // 200 < 300
    expect(gs.fruit).toBeNull();
    gs.tick(100); // 300 -> spawn
    expect(gs.fruit).not.toBeNull();
    expect(gs.fruit!.position).toEqual({ x: 4, y: 1 });
  });

  it('expira depois da duracao se nao for comida (e so reaparece no proximo intervalo)', () => {
    const gs = build({ ...at({ x: 4, y: 1 }), fruitSpawnIntervalMs: 200, fruitDurationMs: 100 });
    gs.start();
    gs.tick(100); // 100 < 200: ainda nada
    expect(gs.fruit).toBeNull();
    gs.tick(100); // 200 -> spawn (dura 100)
    expect(gs.fruit).not.toBeNull();
    gs.tick(100); // fruta zera e some; proximo spawn so aos 400
    expect(gs.fruit).toBeNull();
  });

  it('varias posicoes acendem em rodizio, respeitando o teto de simultaneas', () => {
    const gs = build({
      fruitPositions: [{ x: 2, y: 1 }, { x: 4, y: 1 }],
      fruitSpawnIntervalMs: 100,
      fruitMaxActive: 2,
      fruitDurationMs: 10_000,
    });
    gs.start();
    gs.tick(100); // acende a 1a
    expect(gs.fruits.length).toBe(1);
    gs.tick(100); // acende a 2a
    expect(gs.fruits.length).toBe(2);
    gs.tick(100); // teto atingido: nao acende mais
    expect(gs.fruits.length).toBe(2);
    expect(gs.fruits.map((f) => f.position.x).sort()).toEqual([2, 4]);
  });
});

describe('Fruta — comer', () => {
  it('ao ser comida soma os pontos, emite popup e some', () => {
    const gs = build(
      { ...at({ x: 4, y: 1 }), fruitSpawnIntervalMs: 100, fruitDurationMs: 10_000, fruitValue: 100 },
      Direction.Right,
    );
    gs.start();
    let popups = gs.drainPopups();
    // tick1: fruta acende em (4,1); jogador (1,1)->(2,1). tick3: chega em (4,1) e come.
    for (let i = 0; i < 3; i++) {
      gs.tick(100);
      popups = popups.concat(gs.drainPopups());
    }
    expect(gs.score).toBeGreaterThanOrEqual(100);
    expect(gs.fruit).toBeNull();
    expect(popups.some((p) => p.value === 100)).toBe(true);
  });
});
