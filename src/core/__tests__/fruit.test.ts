import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Pellets } from '../pellets.js';
import { Player } from '../player.js';
import { GameState, type GameConfig } from '../game-state.js';
import { Direction } from '../direction.js';

// Corredor: '#....#' -> pellets em x1..4 (a celula inicial x1 nao e comida).
const ROWS = ['######', '#....#', '######'];
const STEP: Partial<GameConfig> = { baseStepMs: 100, playerSpeed: 1 };

function build(cfg: Partial<GameConfig>): GameState {
  const rows = [...ROWS];
  return new GameState({
    maze: Maze.fromAscii(rows),
    pellets: Pellets.fromAscii(rows),
    player: new Player({ x: 1, y: 1 }, Direction.Right),
    ghosts: [],
    config: { ...STEP, ...cfg },
  });
}

describe('Fruta', () => {
  it('aparece ao cruzar o limiar de dots', () => {
    const gs = build({ fruitDotThresholds: [3], fruitPosition: { x: 1, y: 1 }, fruitDurationMs: 10_000, fruitValue: 100 });
    gs.start();
    for (let i = 0; i < 5; i++) gs.tick(100); // come x2,x3,x4 = 3 dots
    expect(gs.fruit).not.toBeNull();
    expect(gs.fruit!.position).toEqual({ x: 1, y: 1 });
  });

  it('expira depois do tempo se nao for comida', () => {
    const gs = build({ fruitDotThresholds: [3], fruitPosition: { x: 1, y: 1 }, fruitDurationMs: 250, fruitValue: 100 });
    gs.start();
    for (let i = 0; i < 4; i++) gs.tick(100); // spawn (jogador parado na parede, longe da fruta)
    expect(gs.fruit).not.toBeNull();
    for (let i = 0; i < 5; i++) gs.tick(100); // passa dos 250ms
    expect(gs.fruit).toBeNull();
  });

  it('ao ser comida soma os pontos, emite popup e some', () => {
    const gs = build({ fruitDotThresholds: [2], fruitPosition: { x: 4, y: 1 }, fruitDurationMs: 10_000, fruitValue: 100 });
    gs.start();
    let popups = gs.drainPopups();
    for (let i = 0; i < 3; i++) {
      gs.tick(100);
      popups = popups.concat(gs.drainPopups());
    }
    expect(gs.score).toBeGreaterThanOrEqual(100); // pellets + 100 da fruta
    expect(gs.fruit).toBeNull();
    expect(popups.some((p) => p.value === 100)).toBe(true);
  });
});
