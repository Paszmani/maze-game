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

function build(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < WIDTH; x++) {
      const border = x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1;
      if (border) {
        row += y === TUNNEL_ROW && (x === 0 || x === WIDTH - 1) ? 'T' : '#';
      } else if (x % 2 === 0 && y % 2 === 0) {
        row += '#'; // pilar
      } else if (POWER.some((p) => p.x === x && p.y === y)) {
        row += 'o';
      } else {
        row += '.';
      }
    }
    rows.push(row);
  }
  return rows;
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

export const GHOST_SPAWNS: ReadonlyArray<GhostSpawn> = [
  { personality: 'blinky', position: { x: 9, y: 9 }, scatterCorner: { x: WIDTH - 2, y: 1 }, homeTarget: CENTER, direction: Direction.Left },
  { personality: 'pinky', position: { x: 8, y: 9 }, scatterCorner: { x: 1, y: 1 }, homeTarget: CENTER, direction: Direction.Up },
  { personality: 'inky', position: { x: 10, y: 9 }, scatterCorner: { x: WIDTH - 2, y: HEIGHT - 2 }, homeTarget: CENTER, direction: Direction.Down },
  { personality: 'clyde', position: { x: 9, y: 10 }, scatterCorner: { x: 1, y: HEIGHT - 2 }, homeTarget: CENTER, direction: Direction.Up },
];
