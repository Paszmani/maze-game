import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Pellets } from '../pellets.js';
import { Player } from '../player.js';
import { Ghost } from '../ghost-ai.js';
import { GameState, type GameConfig } from '../game-state.js';
import { ScatterChaseSchedule } from '../ghost-modes.js';
import { Direction } from '../direction.js';

/** Intervalos limpos: jogador e fantasma andam 1 celula por tick de 100ms. */
const STEP: Partial<GameConfig> = {
  baseStepMs: 100,
  playerSpeed: 1,
  ghostSpeed: 1,
  frightenedSpeedFactor: 1,
};
const TICK = 100;

const blinky = (over: Partial<ConstructorParameters<typeof Ghost>[0]> = {}) =>
  new Ghost({
    personality: 'blinky',
    position: { x: 2, y: 1 },
    scatterCorner: { x: 4, y: 0 },
    homeTarget: { x: 2, y: 2 },
    mode: 'chase',
    ...over,
  });

describe('GameState — maquina de estados', () => {
  it('comeca em attract e nao ticka', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [],
      config: STEP,
    });
    expect(gs.phase).toBe('attract');
    gs.tick(TICK);
    expect(gs.player.position).toEqual({ x: 1, y: 1 }); // parado no attract
  });

  it('start vai para playing; toAttract volta', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [],
      config: STEP,
    });
    gs.start();
    expect(gs.phase).toBe('playing');
    gs.toAttract();
    expect(gs.phase).toBe('attract');
  });
});

describe('GameState — comer pellets', () => {
  it('pontua ao passar sobre pellets', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [],
      config: STEP,
    });
    gs.start();
    gs.tick(TICK); // (1,1)->(2,1)
    expect(gs.score).toBe(10);
    gs.tick(TICK); // (2,1)->(3,1)
    expect(gs.score).toBe(20);
  });

  it('limpar todos os pellets vence o jogo', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '# ..#', '#####']),
      pellets: Pellets.fromAscii(['#####', '# ..#', '#####']), // pellets em (2,1),(3,1)
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [],
      config: STEP,
    });
    gs.start();
    gs.tick(TICK); // come (2,1)
    gs.tick(TICK); // come (3,1) -> zerou
    expect(gs.phase).toBe('gameover');
    expect(gs.won).toBe(true);
  });
});

describe('GameState — power-pellet e frightened', () => {
  const layout = ['#####', '#.o.#', '#...#', '#####']; // power em (2,1)

  it('comer power-pellet assusta os fantasmas e arma o cronometro', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(layout),
      pellets: Pellets.fromAscii(layout),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [blinky({ position: { x: 1, y: 2 }, mode: 'scatter' })],
      config: { ...STEP, powerDurationMs: 200 },
      rng: () => 0,
    });
    gs.start();
    gs.tick(TICK); // (1,1)->(2,1) come power
    expect(gs.isFrightened).toBe(true);
    expect(gs.frightenedRemainingMs).toBe(200);
    expect(gs.ghosts[0]!.mode).toBe('frightened');
  });

  it('o frightened expira e os fantasmas voltam ao modo base', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(layout),
      pellets: Pellets.fromAscii(layout),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [blinky({ position: { x: 1, y: 2 }, mode: 'scatter' })],
      config: { ...STEP, powerDurationMs: 200 },
      rng: () => 0,
    });
    gs.start();
    gs.tick(TICK); // arma frightened (200ms)
    gs.tick(200); // consome os 200ms -> expira
    expect(gs.isFrightened).toBe(false);
    expect(gs.ghosts[0]!.mode).toBe('scatter');
  });
});

describe('GameState — colisoes', () => {
  it('comer fantasma assustado pontua 200 e o manda para casa', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [blinky()],
      config: STEP,
    });
    gs.start();
    gs.ghosts[0]!.position = { x: 2, y: 1 };
    gs.ghosts[0]!.mode = 'frightened';
    gs.tick(TICK); // jogador entra em (2,1), onde esta o fantasma assustado
    expect(gs.scoring.ghostChain).toBe(1);
    expect(gs.score).toBe(10 + 200); // pellet (2,1) + fantasma
    expect(gs.ghosts[0]!.mode).not.toBe('frightened');
  });

  it('fantasma em chase tira uma vida e reposiciona', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [blinky({ position: { x: 2, y: 1 }, mode: 'chase' })],
      config: STEP,
    });
    gs.start();
    gs.tick(TICK); // colide com o fantasma em (2,1)
    expect(gs.lives).toBe(2);
    expect(gs.phase).toBe('playing');
    expect(gs.player.position).toEqual({ x: 1, y: 1 }); // voltou ao spawn
  });

  it('perder a ultima vida e game over', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [blinky({ position: { x: 2, y: 1 }, mode: 'chase' })],
      config: { ...STEP, startingLives: 1 },
    });
    gs.start();
    gs.tick(TICK);
    expect(gs.lives).toBe(0);
    expect(gs.phase).toBe('gameover');
    expect(gs.won).toBe(false);
  });
});

describe('GameState — vida extra e cronograma', () => {
  it('concede uma vida extra ao cruzar o limiar, uma so vez', () => {
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [],
      config: { ...STEP, extraLifeAt: 20 },
    });
    gs.start();
    gs.tick(TICK); // score 10
    gs.tick(TICK); // score 20 -> vida extra
    expect(gs.lives).toBe(4);
    gs.tick(TICK); // bate na parede, score nao muda
    expect(gs.lives).toBe(4); // nao concede de novo
  });

  it('a virada do cronograma comanda a meia-volta dos fantasmas', () => {
    const schedule = new ScatterChaseSchedule([
      { mode: 'scatter', durationMs: 300 },
      { mode: 'chase', durationMs: null },
    ]);
    const ghost = blinky({ position: { x: 2, y: 2 }, direction: Direction.Right, mode: 'scatter' });
    const gs = new GameState({
      maze: Maze.fromAscii(['#####', '#...#', '#...#', '#####']),
      pellets: Pellets.fromAscii(['#####', '#...#', '#...#', '#####']),
      player: new Player({ x: 1, y: 1 }, Direction.Right),
      ghosts: [ghost],
      // baseStepMs alto isola o cronograma do movimento neste tick
      config: { baseStepMs: 1000, playerSpeed: 1, ghostSpeed: 1, schedule },
    });
    gs.start();
    gs.tick(300); // cruza o limite scatter->chase
    expect(ghost.mode).toBe('chase');
    expect(ghost.direction).toBe(Direction.Left); // inverteu de Right
  });
});
