/**
 * Layout de labirinto no estilo classico de arcade (28x31), escrito a mao e
 * verificado por teste de conectividade (`__tests__/maze-layout.test.ts`), que
 * faz flood-fill a partir do spawn e garante que todo pellet/power/saida da casa
 * e alcancavel. Legenda ASCII (mesma do Maze/Pellets):
 *   '#' parede | '.' pellet | 'o' power-pellet | ' ' caminho sem pellet
 *   'T' tunel (wrap horizontal) | 'D' porta da casa dos fantasmas
 *
 * Simetria esquerda-direita, casa dos fantasmas no centro, tunel na linha do
 * meio (linha 14). Power-pellets nos quatro "cantos" classicos (mantidos como
 * estavam: 4 no total). A fruta bonus tem 5 posicoes (ver FRUIT_POSITIONS).
 *
 * O "achatamento" (deixar o mapa mais quadrado) e so de RENDER: a celula usa
 * largura `TILE` e altura menor `TILE_Y` (ver constants.ts). O formato/grade
 * abaixo NAO muda.
 */

import type { Vec2 } from '../core/direction.js';
import { Direction } from '../core/direction.js';
import type { Personality } from '../core/ghost-ai.js';

// Grade autoral. Cada linha tem exatamente 28 colunas; o teste valida isso.
export const MAZE_LAYOUT: ReadonlyArray<string> = [
  '############################', // 0
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#o####.#####.##.#####.####o#', // 3
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.#####.##.#####.######', // 9
  '######.#####.##.#####.######', // 10
  '######.##..........##.######', // 11
  '######.##.###D####.##.######', // 12
  '######.##.#      #.##.######', // 13
  'T........ #      # ........T', // 14
  '######.##.#      #.##.######', // 15
  '######.##.########.##.######', // 16
  '######.##..........##.######', // 17
  '######.#####.##.#####.######', // 18
  '######.#####.##.#####.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#.####.#####.##.#####.####.#', // 22
  '#o..##................##..o#', // 23
  '###.##.##.########.##.##.###', // 24
  '###.##.##.########.##.##.###', // 25
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30
];

const WIDTH = MAZE_LAYOUT[0]!.length; // 28
const HEIGHT = MAZE_LAYOUT.length; // 31

/** Power-pellets derivadas do proprio ASCII (celulas 'o') — fonte unica de verdade. */
export const POWER: ReadonlyArray<Vec2> = MAZE_LAYOUT.flatMap((row, y) =>
  [...row].flatMap((ch, x) => (ch === 'o' ? [{ x, y }] : [])),
);

/**
 * Casa dos fantasmas (caixa fisica): interior de 6x3 celulas (cols 11-16, linhas
 * 13-15), porta 'D' unica no topo (col 13) e a celula-saida logo acima dela. O
 * interior ja e ' ' no ASCII (caminhavel, sem pellet). A porta so e atravessavel
 * pelas rotas de fantasma (saida quando liberado / retorno dos olhos).
 */
export const HOUSE_INTERIOR: ReadonlyArray<Vec2> = (() => {
  const cells: Vec2[] = [];
  for (let y = 13; y <= 15; y++) for (let x = 11; x <= 16; x++) cells.push({ x, y });
  return cells;
})();
export const HOUSE_DOOR: Vec2 = { x: 13, y: 12 };
export const HOUSE_EXIT: Vec2 = { x: 13, y: 11 };

/** Onde o jogador nasce — no corredor logo abaixo da casa. */
export const PLAYER_SPAWN: Vec2 = { x: 13, y: 23 };

/**
 * Posicoes da fruta bonus (100 pts). A original fica logo abaixo da casa; as
 * outras quatro espalham o coletavel pelo mapa. O core faz a fruta reaparecer
 * periodicamente, entao varias podem estar visiveis ao mesmo tempo.
 */
export const FRUIT_POSITIONS: ReadonlyArray<Vec2> = [
  { x: 13, y: 17 }, // abaixo da casa (posicao classica)
  { x: 6, y: 8 },
  { x: 21, y: 8 },
  { x: 6, y: 20 },
  { x: 21, y: 20 },
];

export interface GhostSpawn {
  personality: Personality;
  position: Vec2;
  scatterCorner: Vec2;
  homeTarget: Vec2;
  direction: Direction;
}

const CENTER: Vec2 = { x: 13, y: 14 };

// Blinky nasce ja na saida (acima da porta); os demais dentro da caixa e sobem
// pela porta quando liberados. homeTarget = centro da casa (destino dos olhos).
export const GHOST_SPAWNS: ReadonlyArray<GhostSpawn> = [
  { personality: 'blinky', position: { ...HOUSE_EXIT }, scatterCorner: { x: WIDTH - 2, y: 1 }, homeTarget: CENTER, direction: Direction.Left },
  { personality: 'pinky', position: { x: 13, y: 14 }, scatterCorner: { x: 1, y: 1 }, homeTarget: CENTER, direction: Direction.Up },
  { personality: 'inky', position: { x: 12, y: 14 }, scatterCorner: { x: WIDTH - 2, y: HEIGHT - 2 }, homeTarget: CENTER, direction: Direction.Up },
  { personality: 'clyde', position: { x: 15, y: 14 }, scatterCorner: { x: 1, y: HEIGHT - 2 }, homeTarget: CENTER, direction: Direction.Up },
];
