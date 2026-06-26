/**
 * Sanidade do layout: faz flood-fill a partir do spawn do jogador e confirma que
 * todo pellet/power e alcancavel. Roda com `npx tsx scripts/validate-maze.ts`.
 */

import { Maze } from '../src/core/maze.js';
import { Pellets } from '../src/core/pellets.js';
import { MAZE_LAYOUT, PLAYER_SPAWN, GHOST_SPAWNS } from '../src/render/maze-layout.js';
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

for (const g of GHOST_SPAWNS) {
  const ok = maze.isWalkable(g.position.x, g.position.y) && seen.has(key(g.position.x, g.position.y));
  console.log(`  ${g.personality} spawn (${g.position.x},${g.position.y}): ${ok ? 'OK' : 'INVALIDO'}`);
}

if (unreachable > 0) {
  console.error('FALHA: ha pellets inalcancaveis.');
  process.exit(1);
}
console.log('OK: labirinto conectado, todos os pellets alcancaveis.');
