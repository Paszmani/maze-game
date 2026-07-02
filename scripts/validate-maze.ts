/**
 * Sanidade do layout: faz flood-fill a partir do spawn do jogador e confirma que
 * todo pellet/power e alcancavel. Roda com `npx tsx scripts/validate-maze.ts`.
 */

import { Maze } from '../src/core/maze.js';
import { Pellets } from '../src/core/pellets.js';
import {
  MAZE_LAYOUT,
  PLAYER_SPAWN,
  GHOST_SPAWNS,
  HOUSE_INTERIOR,
  HOUSE_DOOR,
  HOUSE_EXIT,
} from '../src/render/maze-layout.js';
import { Direction } from '../src/core/direction.js';

const rows = [...MAZE_LAYOUT];
const maze = Maze.fromAscii(rows);
const pellets = Pellets.fromAscii(rows);

const seen = new Set<string>();
const key = (x: number, y: number) => `${x},${y}`;
const queue = [{ ...PLAYER_SPAWN }];
seen.add(key(PLAYER_SPAWN.x, PLAYER_SPAWN.y));

while (queue.length > 0) {
  const cur = queue.shift()!;
  for (const dir of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
    const next = maze.step(cur, dir);
    if (next && !seen.has(key(next.x, next.y))) {
      seen.add(key(next.x, next.y));
      queue.push(next);
    }
  }
}

let unreachable = 0;
let total = 0;
for (let y = 0; y < maze.height; y++) {
  for (let x = 0; x < maze.width; x++) {
    if (pellets.hasPellet(x, y) || pellets.hasPowerPellet(x, y)) {
      total++;
      if (!seen.has(key(x, y))) {
        unreachable++;
        console.log(`  pellet inalcancavel em (${x},${y})`);
      }
    }
  }
}

console.log(`Labirinto ${maze.width}x${maze.height}`);
console.log(`Celulas caminhaveis alcancadas: ${seen.size}`);
console.log(`Pellets: ${total}  |  inalcancaveis: ${unreachable}`);

// Spawns internos da casa ficam SELADOS (so alcancaveis pela porta de fantasma);
// nao precisam ser alcancaveis pelo flood-fill do jogador.
const interior = new Set(HOUSE_INTERIOR.map((c) => key(c.x, c.y)));
for (const g of GHOST_SPAWNS) {
  const k = key(g.position.x, g.position.y);
  const inHouse = interior.has(k);
  const ok = maze.isWalkable(g.position.x, g.position.y) && (seen.has(k) || inHouse);
  console.log(`  ${g.personality} spawn (${g.position.x},${g.position.y}): ${ok ? 'OK' : 'INVALIDO'}${inHouse ? ' (na casa)' : ''}`);
}

// A porta precisa ser tile 'door' e a celula-saida precisa ser alcancavel pelo
// labirinto (para os olhos comidos conseguirem chegar ate ela e reentrar).
const doorOk = maze.isDoor(HOUSE_DOOR.x, HOUSE_DOOR.y);
const exitReachable = seen.has(key(HOUSE_EXIT.x, HOUSE_EXIT.y));
console.log(`  porta (${HOUSE_DOOR.x},${HOUSE_DOOR.y}) e 'door': ${doorOk ? 'OK' : 'INVALIDO'}`);
console.log(`  saida (${HOUSE_EXIT.x},${HOUSE_EXIT.y}) alcancavel: ${exitReachable ? 'OK' : 'INVALIDO'}`);
console.log(`  interior selado (jogador nao entra): ${HOUSE_INTERIOR.every((c) => !seen.has(key(c.x, c.y))) ? 'OK' : 'FALHA (jogador alcanca a casa)'}`);

if (unreachable > 0 || !doorOk || !exitReachable) {
  console.error('FALHA na validacao do labirinto.');
  process.exit(1);
}
console.log('OK: labirinto conectado, pellets alcancaveis, casa selada com porta de fantasma.');
