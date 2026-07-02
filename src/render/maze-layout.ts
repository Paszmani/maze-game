/**
 * Layout de labirinto provisorio, gerado em codigo para garantir conectividade
 * (sem erro de digitacao a mao). Padrao de "treliça": pilares nas celulas par/par
 * deixam todos os corredores ligados. Power-pellets nos quatro cantos, tunel na
 * linha central.
 *
 * No futuro o labirinto pode vir de dado/tema; por ora isto basta para o render
 * do modulo 4. As funcoes do core (Maze/Pellets) leem esta mesma string ASCII.
 */

import type { Vec2 } from '../core/direction.js';
import { Direction } from '../core/direction.js';
import type { Personality } from '../core/ghost-ai.js';

const WIDTH = 19;
const HEIGHT = 19;
const TUNNEL_ROW = 9; // linha impar => corredor aberto de ponta a ponta

const POWER: ReadonlyArray<Vec2> = [
  { x: 1, y: 1 },
  { x: WIDTH - 2, y: 1 },
  { x: 1, y: HEIGHT - 2 },
  { x: WIDTH - 2, y: HEIGHT - 2 },
];

/**
 * Casa dos fantasmas (caixa fisica), estampada sobre a treliça. Caixa de 3x1
 * celulas internas com uma porta 'D' no topo (so rota de fantasma). ' ' =
 * caminhavel sem pellet.
 */
export const HOUSE_INTERIOR: ReadonlyArray<Vec2> = [
  { x: 8, y: 9 },
  { x: 9, y: 9 },
  { x: 10, y: 9 },
];
export const HOUSE_DOOR: Vec2 = { x: 9, y: 8 };
export const HOUSE_EXIT: Vec2 = { x: 9, y: 7 };
/** Paredes extras que fecham a caixa (alem dos pilares ja existentes da treliça). */
const HOUSE_WALLS: ReadonlyArray<Vec2> = [
  { x: 7, y: 9 },
  { x: 11, y: 9 },
  { x: 9, y: 10 },
];

function build(): string[] {
  const grid: string[][] = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row: string[] = [];
    for (let x = 0; x < WIDTH; x++) {
      const border = x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1;
      if (border) {
        row.push(y === TUNNEL_ROW && (x === 0 || x === WIDTH - 1) ? 'T' : '#');
      } else if (x % 2 === 0 && y % 2 === 0) {
        row.push('#'); // pilar
      } else if (POWER.some((p) => p.x === x && p.y === y)) {
        row.push('o');
      } else {
        row.push('.');
      }
    }
    grid.push(row);
  }

  // Estampa a casa: paredes fecham a caixa; interior fica livre e sem pellet
  // (' '); a porta e um tile 'D' — bloqueada para todos, exceto as rotas de
  // fantasma (saida quando liberado, retorno dos olhos).
  for (const w of HOUSE_WALLS) grid[w.y]![w.x] = '#';
  for (const c of HOUSE_INTERIOR) grid[c.y]![c.x] = ' ';
  grid[HOUSE_DOOR.y]![HOUSE_DOOR.x] = 'D';

  return grid.map((row) => row.join(''));
}

export const MAZE_LAYOUT: ReadonlyArray<string> = build();

export const PLAYER_SPAWN: Vec2 = { x: 9, y: 15 };

/** Onde a fruta aparece — logo abaixo do centro (casa dos fantasmas). */
export const FRUIT_POSITION: Vec2 = { x: 9, y: 11 };

export interface GhostSpawn {
  personality: Personality;
  position: Vec2;
  scatterCorner: Vec2;
  homeTarget: Vec2;
  direction: Direction;
}

const CENTER: Vec2 = { x: 9, y: 9 };

// Blinky nasce ja na saida (acima da porta); os demais dentro da caixa e sobem
// pela porta quando liberados. homeTarget = centro da casa (destino dos olhos).
export const GHOST_SPAWNS: ReadonlyArray<GhostSpawn> = [
  { personality: 'blinky', position: { ...HOUSE_EXIT }, scatterCorner: { x: WIDTH - 2, y: 1 }, homeTarget: CENTER, direction: Direction.Left },
  { personality: 'pinky', position: { x: 9, y: 9 }, scatterCorner: { x: 1, y: 1 }, homeTarget: CENTER, direction: Direction.Up },
  { personality: 'inky', position: { x: 8, y: 9 }, scatterCorner: { x: WIDTH - 2, y: HEIGHT - 2 }, homeTarget: CENTER, direction: Direction.Up },
  { personality: 'clyde', position: { x: 10, y: 9 }, scatterCorner: { x: 1, y: HEIGHT - 2 }, homeTarget: CENTER, direction: Direction.Up },
];
