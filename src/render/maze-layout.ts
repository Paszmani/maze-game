/**
 * Layout de labirinto COMPACTO (19x31 -> 19x21) para partidas curtas de totem
 * (~1 min por rodada). Escrito a mao e verificado por teste de conectividade
 * (`__tests__/maze-layout.test.ts`), que faz flood-fill a partir do spawn e
 * garante que todo pellet/power/saida da casa e alcancavel. Legenda ASCII
 * (mesma do Maze/Pellets):
 *   '#' parede | '.' pellet | 'o' power-pellet | ' ' caminho sem pellet
 *   'T' tunel (wrap horizontal) | 'D' porta da casa dos fantasmas
 *
 * Simetria esquerda-direita (eixo na coluna 9), casa dos fantasmas no centro,
 * tunel na linha do meio (linha 10). Power-pellets nos quatro "cantos" (4 no
 * total, como no classico). A fruta bonus tem 5 posicoes (ver FRUIT_POSITIONS).
 *
 * A cara do classico foi mantida (corredores simetricos, casa central com porta
 * unica, power nos cantos, tunel lateral), mas o campo foi bem reduzido: ~112
 * pellets contra ~292 do mapa arcade completo, para encurtar a partida.
 *
 * O "achatamento" (deixar o mapa mais quadrado) e so de RENDER: a celula usa
 * largura `TILE` e altura menor `TILE_Y` (ver constants.ts). O formato/grade
 * abaixo NAO muda com isso. Todo o render/camera deriva de `maze.width/height`,
 * entao trocar de grade nao exige mexer no resto do codigo.
 */

import type { Vec2 } from '../core/direction.js';
import { Direction } from '../core/direction.js';
import type { Personality } from '../core/ghost-ai.js';

// Grade autoral. Cada linha tem exatamente 19 colunas; o teste valida isso.
export const MAZE_LAYOUT: ReadonlyArray<string> = [
  '###################', // 0
  '#.................#', // 1
  '#.##.####.####.##.#', // 2
  '#o##.####.####.##o#', // 3
  '#.#######.#######.#', // 4
  '#.##.####.####.##.#', // 5
  '#.##.####.####.##.#', // 6
  '#........ ........#', // 7
  '#.#######D#######.#', // 8
  '#.######   ######.#', // 9
  'T......#   #......T', // 10
  '#.###############.#', // 11
  '#.#####.....#####.#', // 12
  '#.................#', // 13
  '#.##.####.####.##.#', // 14
  '#.##.####.####.##.#', // 15
  '#.#######.#######.#', // 16
  '#o##.####.####.##o#', // 17
  '#.##.####.####.##.#', // 18
  '#.................#', // 19
  '###################', // 20
];

const WIDTH = MAZE_LAYOUT[0]!.length; // 19
const HEIGHT = MAZE_LAYOUT.length; // 21

/** Power-pellets derivadas do proprio ASCII (celulas 'o') — fonte unica de verdade. */
export const POWER: ReadonlyArray<Vec2> = MAZE_LAYOUT.flatMap((row, y) =>
  [...row].flatMap((ch, x) => (ch === 'o' ? [{ x, y }] : [])),
);

/**
 * Casa dos fantasmas (caixa fisica): interior de 3x2 celulas (cols 8-10, linhas
 * 9-10), porta 'D' unica no topo (col 9) e a celula-saida logo acima dela. O
 * interior ja e ' ' no ASCII (caminhavel, sem pellet). A porta so e atravessavel
 * pelas rotas de fantasma (saida quando liberado / retorno dos olhos).
 */
export const HOUSE_INTERIOR: ReadonlyArray<Vec2> = (() => {
  const cells: Vec2[] = [];
  for (let y = 9; y <= 10; y++) for (let x = 8; x <= 10; x++) cells.push({ x, y });
  return cells;
})();
export const HOUSE_DOOR: Vec2 = { x: 9, y: 8 };
export const HOUSE_EXIT: Vec2 = { x: 9, y: 7 };

/** Onde o jogador nasce — no corredor logo abaixo da casa. */
export const PLAYER_SPAWN: Vec2 = { x: 9, y: 13 };

/**
 * Posicoes da fruta bonus (100 pts). A original fica logo abaixo da casa; as
 * outras quatro espalham o coletavel pelo mapa. O core faz a fruta reaparecer
 * periodicamente, entao varias podem estar visiveis ao mesmo tempo.
 */
export const FRUIT_POSITIONS: ReadonlyArray<Vec2> = [
  { x: 9, y: 12 }, // abaixo da casa (posicao classica)
  { x: 4, y: 2 },
  { x: 14, y: 2 },
  { x: 4, y: 18 },
  { x: 14, y: 18 },
];

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
