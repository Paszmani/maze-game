import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Pellets } from '../pellets.js';
import { Player } from '../player.js';
import { Ghost } from '../ghost-ai.js';
import { GameState, type GameConfig } from '../game-state.js';
import { Direction } from '../direction.js';

/**
 * Corredor de dots em cima (y1) e uma "casa" isolada embaixo (y3, separada por
 * parede solida) — fantasmas soltos ali nao alcancam o jogador, entao a colisao
 * nao interfere no teste de liberacao.
 */
// (1,1) e vazio (espaco) para o jogador parado nao "comer" a celula inicial.
const HOUSE_MAZE = ['########', '# .....#', '########', '##....##', '########'];

const STEP: Partial<GameConfig> = { baseStepMs: 100, playerSpeed: 1, ghostSpeed: 1 };

function build(cfg: Partial<GameConfig>, playerDir: Direction = Direction.Right): GameState {
  const rows = [...HOUSE_MAZE];
  const ghost = (personality: 'blinky' | 'pinky' | 'inky' | 'clyde', x: number) =>
    new Ghost({
      personality,
      position: { x, y: 3 },
      scatterCorner: { x: 1, y: 1 },
      homeTarget: { x: 3, y: 3 },
      direction: Direction.Left,
      mode: 'scatter',
    });
  return new GameState({
    maze: Maze.fromAscii(rows),
    pellets: Pellets.fromAscii(rows),
    player: new Player({ x: 1, y: 1 }, playerDir),
    ghosts: [ghost('blinky', 2), ghost('pinky', 3), ghost('inky', 4), ghost('clyde', 5)],
    config: { ...STEP, ...cfg },
  });
}

const find = (gs: GameState, p: string) => gs.ghosts.find((g) => g.personality === p)!;

describe('Ghost house — liberacao escalonada', () => {
  it('blinky/pinky comecam fora; inky/clyde comecam dentro (limites default)', () => {
    const gs = build({ dotLimits: { blinky: 0, pinky: 0, inky: 30, clyde: 60 }, releaseFallbackMs: 1e9 });
    gs.start();
    expect(find(gs, 'blinky').houseState).toBe('out');
    expect(find(gs, 'pinky').houseState).toBe('out');
    expect(find(gs, 'inky').houseState).toBe('inside');
    expect(find(gs, 'clyde').houseState).toBe('inside');
  });

  it('libera na ordem pinky -> inky -> clyde conforme os dots sobem', () => {
    const gs = build({ dotLimits: { blinky: 0, pinky: 1, inky: 2, clyde: 3 }, releaseFallbackMs: 1e9 });
    gs.start();
    gs.player.queue(Direction.Right);

    const releaseAt: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      gs.tick(100);
      for (const p of ['pinky', 'inky', 'clyde']) {
        if (releaseAt[p] === undefined && find(gs, p).houseState === 'out') releaseAt[p] = gs.dots;
      }
    }
    expect(releaseAt.pinky).toBeGreaterThanOrEqual(1);
    expect(releaseAt.pinky!).toBeLessThan(releaseAt.inky!);
    expect(releaseAt.inky!).toBeLessThan(releaseAt.clyde!);
  });

  it('fallback de tempo libera mesmo sem comer dots', () => {
    // Jogador parado (direcao None) -> nenhum dot; o timer acumula.
    const gs = build({ dotLimits: { blinky: 0, pinky: 999, inky: 999, clyde: 999 }, releaseFallbackMs: 1000 }, Direction.None);
    gs.start();
    gs.tick(500);
    expect(find(gs, 'pinky').houseState).toBe('inside');
    gs.tick(600); // total ~1100 >= 1000
    expect(find(gs, 'pinky').houseState).toBe('out');
  });
});

describe('Ghost house — olhos voltam para casa', () => {
  it('fantasma comido que alcanca a casa volta a esperar e e re-liberado', () => {
    // Maze aberto pequeno para o blinky andar ate o homeTarget.
    const rows = ['#####', '#...#', '#...#', '#####'];
    const blinky = new Ghost({
      personality: 'blinky',
      position: { x: 2, y: 1 },
      scatterCorner: { x: 1, y: 1 },
      homeTarget: { x: 2, y: 2 },
      direction: Direction.Down,
      mode: 'scatter',
    });
    const gs = new GameState({
      maze: Maze.fromAscii(rows),
      pellets: Pellets.fromAscii(rows),
      player: new Player({ x: 1, y: 1 }, Direction.None),
      ghosts: [blinky],
      config: { ...STEP, dotLimits: { blinky: 0, pinky: 0, inky: 0, clyde: 0 } },
    });
    gs.start();
    // Vira "olhos" voltando para casa.
    blinky.mode = 'eaten';
    blinky.position = { x: 2, y: 1 };

    gs.tick(100); // chega no homeTarget (2,2) -> vira a esperar
    expect(blinky.houseState).toBe('inside');
    expect(blinky.mode).not.toBe('eaten');

    gs.tick(100); // re-liberado (returned)
    expect(blinky.houseState).toBe('out');
  });
});
