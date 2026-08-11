import { describe, it, expect } from 'vitest';
import { Maze } from '../maze.js';
import { Pellets } from '../pellets.js';
import { Player } from '../player.js';
import { GameState, type GameConfig } from '../game-state.js';
import { Direction } from '../direction.js';

// Jogador parado (Direction.None): isola o cronometro do fim por limpar pellets.
const ROWS = ['#####', '#...#', '#####'];
const STEP: Partial<GameConfig> = { baseStepMs: 100, playerSpeed: 1 };

function build(cfg: Partial<GameConfig>): GameState {
  const rows = [...ROWS];
  return new GameState({
    maze: Maze.fromAscii(rows),
    pellets: Pellets.fromAscii(rows),
    player: new Player({ x: 1, y: 1 }, Direction.None),
    ghosts: [],
    config: { ...STEP, ...cfg },
  });
}

describe('Temporizador — modo regressivo (countdown)', () => {
  it('conta para tras e encerra o jogo ao zerar', () => {
    const gs = build({ timerMode: 'countdown', timeLimitMs: 250 });
    gs.start();
    gs.tick(100);
    expect(gs.phase).toBe('playing');
    expect(gs.timeRemainingMs).toBe(150);
    gs.tick(100);
    expect(gs.timeRemainingMs).toBe(50);
    gs.tick(100); // passa dos 250ms
    expect(gs.phase).toBe('gameover');
    expect(gs.isTimeUp).toBe(true);
    expect(gs.won).toBe(false);
    expect(gs.timeRemainingMs).toBe(0);
  });
});

describe('Temporizador — modo crescente (countup)', () => {
  it('conta para cima sem encerrar o jogo por si so', () => {
    const gs = build({ timerMode: 'countup' });
    gs.start();
    gs.tick(100);
    gs.tick(100);
    expect(gs.elapsedMs).toBe(200);
    expect(gs.phase).toBe('playing');
    expect(gs.timeRemainingMs).toBe(0); // crescente nao tem "restante"
    expect(gs.isTimeUp).toBe(false);
  });
});

describe('Temporizador — desligado (off)', () => {
  it('nao acumula tempo nem encerra o jogo', () => {
    const gs = build({ timerMode: 'off' });
    gs.start();
    gs.tick(100);
    gs.tick(100);
    expect(gs.elapsedMs).toBe(0);
    expect(gs.phase).toBe('playing');
  });
});
