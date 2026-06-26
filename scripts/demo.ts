/**
 * Demo de terminal — NAO faz parte do jogo, so prova que o core funciona.
 *
 * Desenha um labirinto em ASCII e anima o jogador (@) correndo pelo anel externo
 * enquanto o fantasma blinky (M) o persegue, usando exatamente o mesmo core/ que
 * os testes exercitam. Sem Phaser, sem pixels — so a logica ticando.
 *
 *   npm run demo
 */

import { Maze } from '../src/core/maze.js';
import { Player } from '../src/core/player.js';
import { Ghost } from '../src/core/ghost-ai.js';
import { Direction } from '../src/core/direction.js';

const ROWS = [
  '#########',
  '#.......#',
  '#.##.##.#',
  '#.#...#.#',
  'T...#...T',
  '#.#...#.#',
  '#.##.##.#',
  '#.......#',
  '#########',
];

const maze = Maze.fromAscii(ROWS);

const player = new Player({ x: 1, y: 1 }, Direction.Right);
const blinky = new Ghost({
  personality: 'blinky',
  position: { x: 7, y: 7 },
  scatterCorner: { x: 8, y: 0 },
  homeTarget: { x: 4, y: 4 },
  direction: Direction.Up,
  mode: 'chase',
});

// Modo frightened nao e usado aqui; rng fixo so satisfaz a assinatura.
const rng = () => 0;

// Roteiro do jogador: percorre o anel externo (direita, baixo, esquerda, cima).
const ROUTE = [Direction.Right, Direction.Down, Direction.Left, Direction.Up];
const route = (tick: number): Direction => ROUTE[Math.floor(tick / 6) % ROUTE.length]!;

function frame(tick: number): string {
  let out = `tick ${String(tick).padStart(2, '0')}   @ = jogador   M = fantasma\n\n`;
  for (let y = 0; y < maze.height; y++) {
    let line = '';
    for (let x = 0; x < maze.width; x++) {
      if (player.position.x === x && player.position.y === y) line += '@';
      else if (blinky.position.x === x && blinky.position.y === y) line += 'M';
      else {
        const tile = maze.tileAt(x, y);
        line += tile === 'wall' ? '#' : tile === 'tunnel' ? '=' : ' ';
      }
    }
    out += line + '\n';
  }
  const caught = player.position.x === blinky.position.x && player.position.y === blinky.position.y;
  return out + (caught ? '\n>> o fantasma alcancou o jogador <<\n' : '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FRAMES = 28;

for (let t = 0; t < FRAMES; t++) {
  player.queue(route(t));
  player.update(maze);
  blinky.update(maze, { pacman: player.position, pacmanDir: player.direction, blinky: blinky.position }, rng);

  console.clear();
  console.log(frame(t));

  if (player.position.x === blinky.position.x && player.position.y === blinky.position.y) break;
  await sleep(160);
}
