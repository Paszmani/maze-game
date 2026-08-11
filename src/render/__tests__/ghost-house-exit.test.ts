import { describe, it, expect } from 'vitest';
import { Maze } from '../../core/maze.js';
import { Pellets } from '../../core/pellets.js';
import { Player } from '../../core/player.js';
import { Ghost } from '../../core/ghost-ai.js';
import { GameState, type GameConfig } from '../../core/game-state.js';
import { Direction, equalsVec } from '../../core/direction.js';
import {
  MAZE_LAYOUT,
  GHOST_SPAWNS,
  PLAYER_SPAWN,
  HOUSE_INTERIOR,
  HOUSE_DOOR,
  HOUSE_EXIT,
} from '../maze-layout.js';

/**
 * Saida roteirizada da caixa fisica: um fantasma que comeca (ou e liberado)
 * dentro da casa precisa atravessar a porta e chegar a celula-saida sem ficar
 * preso. Usa o labirinto REAL (com a casa estampada) para pegar regressoes de
 * geometria — a regra greedy sozinha oscilaria na caixa concava.
 */
function build(cfg: Partial<GameConfig> = {}): GameState {
  const rows = [...MAZE_LAYOUT];
  const ghosts = GHOST_SPAWNS.map(
    (g) =>
      new Ghost({
        personality: g.personality,
        position: { ...g.position },
        scatterCorner: g.scatterCorner,
        homeTarget: g.homeTarget,
        direction: g.direction,
        mode: 'scatter',
      }),
  );
  return new GameState({
    maze: Maze.fromAscii(rows),
    pellets: Pellets.fromAscii(rows),
    player: new Player({ ...PLAYER_SPAWN }, Direction.None),
    ghosts,
    config: {
      baseStepMs: 100,
      playerSpeed: 1,
      ghostSpeed: 1,
      houseInterior: HOUSE_INTERIOR.map((c) => ({ ...c })),
      houseDoor: { ...HOUSE_DOOR },
      houseExit: { ...HOUSE_EXIT },
      // Vidas de sobra: uma colisao tardia nao apaga o rastro ja coletado.
      startingLives: 99,
      ...cfg,
    },
    rng: () => 0,
  });
}

const find = (gs: GameState, p: string) => gs.ghosts.find((g) => g.personality === p)!;

describe('Casa dos fantasmas — saida roteirizada (maze real)', () => {
  it('porta bloqueia o passo comum (jogador/IA) e so passa com throughDoor', () => {
    const gs = build();
    for (const c of HOUSE_INTERIOR) {
      expect(gs.maze.isWalkable(c.x, c.y)).toBe(true);
      expect(gs.pellets.hasPellet(c.x, c.y)).toBe(false);
    }
    // A porta e um tile proprio: NAO caminhavel no passo comum.
    expect(gs.maze.isDoor(HOUSE_DOOR.x, HOUSE_DOOR.y)).toBe(true);
    expect(gs.maze.isWalkable(HOUSE_DOOR.x, HOUSE_DOOR.y)).toBe(false);
    // De cima (celula-saida) descer para a porta: bloqueado no passo comum...
    expect(gs.maze.step(HOUSE_EXIT, Direction.Down)).toBeNull();
    // ...mas liberado para a rota de fantasma.
    expect(gs.maze.step(HOUSE_EXIT, Direction.Down, { throughDoor: true })).toEqual(HOUSE_DOOR);
    // De dentro (logo abaixo da porta) subir para ela: idem.
    const belowDoor = { x: HOUSE_DOOR.x, y: HOUSE_DOOR.y + 1 };
    expect(gs.maze.step(belowDoor, Direction.Up)).toBeNull();
    expect(gs.maze.step(belowDoor, Direction.Up, { throughDoor: true })).toEqual(HOUSE_DOOR);
    // A saida em si e caminhavel normal (corredor aberto).
    expect(gs.maze.isWalkable(HOUSE_EXIT.x, HOUSE_EXIT.y)).toBe(true);
  });

  it('os fantasmas que nascem dentro atravessam a porta ate a saida (nao prendem)', () => {
    // Todos liberados de imediato: os de dentro (pinky/inky/clyde) sao roteirizados.
    const gs = build({ dotLimits: { blinky: 0, pinky: 0, inky: 0, clyde: 0 } });
    gs.start();

    const visitedExit: Record<string, boolean> = {};
    for (let i = 0; i < 30; i++) {
      gs.tick(100);
      for (const g of gs.ghosts) {
        if (equalsVec(g.position, HOUSE_EXIT)) visitedExit[g.personality] = true;
      }
    }

    // Os tres que nascem dentro precisam ter passado pela celula-saida.
    for (const p of ['pinky', 'inky', 'clyde']) {
      expect(visitedExit[p], `${p} nao atravessou a porta`).toBe(true);
    }
    // E ninguem fica preso no interior depois de sair.
    const inside = new Set(HOUSE_INTERIOR.map((c) => `${c.x},${c.y}`));
    for (const g of gs.ghosts) {
      expect(inside.has(`${g.position.x},${g.position.y}`)).toBe(false);
    }
  });

  // Regressao (achada no soak test): a caixa murada criava um minimo local para a
  // IA greedy dos olhos, que ficavam presos ao redor da casa sem achar a porta.
  // O retorno por BFS tem que trazer os olhos de QUALQUER ponto ate o centro.
  it.each([
    { x: 13, y: 17 }, // logo abaixo da casa (bridge inferior)
    { x: 6, y: 8 }, // bolso lateral-superior
    { x: 1, y: 1 }, // canto superior esquerdo
    { x: 26, y: 29 }, // canto inferior direito
  ])('olhos comidos em (%o) voltam para a casa sem travar', (start) => {
    const gs = build({ dotLimits: { blinky: 0, pinky: 0, inky: 0, clyde: 0 } });
    gs.start();
    const blinky = find(gs, 'blinky');
    blinky.mode = 'eaten';
    blinky.position = { ...start };
    blinky.houseState = 'out';

    let reached = false;
    for (let i = 0; i < 300 && !reached; i++) {
      gs.tick(100);
      if (find(gs, 'blinky').houseState === 'inside') reached = true;
    }
    expect(reached, `olhos de (${start.x},${start.y}) nao voltaram`).toBe(true);
  });

  it('um fantasma liberado depois (por fallback de tempo) tambem escapa pela porta', () => {
    // inky/clyde so saem pelo fallback curto; ao serem liberados, sobem pela porta.
    const gs = build({ dotLimits: { blinky: 0, pinky: 0, inky: 99, clyde: 99 }, releaseFallbackMs: 300 });
    gs.start();
    expect(find(gs, 'inky').houseState).toBe('inside'); // comeca esperando

    let escaped = false;
    for (let i = 0; i < 40 && !escaped; i++) {
      gs.tick(100);
      const inky = find(gs, 'inky');
      if (inky.houseState === 'out' && inky.position.y <= HOUSE_EXIT.y) escaped = true;
    }
    expect(escaped).toBe(true);
  });
});
