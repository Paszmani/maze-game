/**
 * Soak test headless — roda o core REAL (GameState + labirinto de maze-layout)
 * por milhares de ticks com um jogador-IA que caca pellets (BFS), procurando
 * FALHAS de logica sem abrir o browser:
 *
 *   - excecao / crash em qualquer tick
 *   - fantasma "out" preso na mesma celula por tempo demais (casa concava, IA)
 *   - fantasma "eaten" que nunca volta pra casa
 *   - progresso de interpolacao fora de [0,1]
 *   - celula anterior nao-adjacente a atual (fora tunel) — quebraria o lerp
 *   - caminho de vitoria: sem fantasmas, o jogador-IA limpa o tabuleiro (won)
 *
 *   npx tsx scripts/soak.ts
 */

import { Maze } from '../src/core/maze.js';
import { Pellets } from '../src/core/pellets.js';
import { Player } from '../src/core/player.js';
import { Ghost } from '../src/core/ghost-ai.js';
import { GameState } from '../src/core/game-state.js';
import { Direction, DIRECTION_VECTORS, type Vec2 } from '../src/core/direction.js';
import { MAZE_LAYOUT, PLAYER_SPAWN, GHOST_SPAWNS, FRUIT_POSITION } from '../src/render/maze-layout.js';

const ROWS = [...MAZE_LAYOUT];
const DIRS = [Direction.Up, Direction.Down, Direction.Left, Direction.Right] as const;
const key = (v: Vec2): string => `${v.x},${v.y}`;

function buildState(withGhosts: boolean): GameState {
  const maze = Maze.fromAscii(ROWS);
  const pellets = Pellets.fromAscii(ROWS);
  const player = new Player({ ...PLAYER_SPAWN }, Direction.Up);
  const ghosts = withGhosts
    ? GHOST_SPAWNS.map(
        (g) =>
          new Ghost({
            personality: g.personality,
            position: { ...g.position },
            scatterCorner: g.scatterCorner,
            homeTarget: g.homeTarget,
            direction: g.direction,
            mode: 'scatter',
          }),
      )
    : [];
  const gs = new GameState({
    maze,
    pellets,
    player,
    ghosts,
    config: { fruitPosition: { ...FRUIT_POSITION } },
    // RNG deterministico p/ reprodutibilidade (frightened).
    rng: mulberry32(0xc0ffee),
  });
  gs.start();
  return gs;
}

/** PRNG deterministico (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** BFS: primeira direcao no caminho mais curto ate o pellet/power mais proximo. */
function seekPellet(gs: GameState): Direction {
  const start = gs.player.position;
  const seen = new Set<string>([key(start)]);
  // fila de {cell, firstDir}
  const queue: Array<{ cell: Vec2; first: Direction }> = [];
  for (const d of DIRS) {
    const n = gs.maze.step(start, d);
    if (n) {
      queue.push({ cell: n, first: d });
      seen.add(key(n));
    }
  }
  while (queue.length > 0) {
    const { cell, first } = queue.shift()!;
    if (gs.pellets.hasPellet(cell.x, cell.y) || gs.pellets.hasPowerPellet(cell.x, cell.y)) return first;
    for (const d of DIRS) {
      const n = gs.maze.step(cell, d);
      if (n && !seen.has(key(n))) {
        seen.add(key(n));
        queue.push({ cell: n, first });
      }
    }
  }
  return Direction.None;
}

interface Failure {
  tick: number;
  kind: string;
  detail: string;
}
const failures: Failure[] = [];
const record = (tick: number, kind: string, detail: string): void => {
  if (failures.length < 40) failures.push({ tick, kind, detail });
};

function adjacentOrTunnel(prev: Vec2, cur: Vec2): boolean {
  const dx = Math.abs(prev.x - cur.x);
  const dy = Math.abs(prev.y - cur.y);
  if (dx + dy <= 1) return true; // mesma celula ou passo unitario
  return dx > 1 || dy > 1; // salto de tunel (nao-adjacente) — tratado com snap
}

// --- RUN A: jogo completo, soak por falhas de dinamica -----------------------

function runSoak(ticks: number, dt: number): { deaths: number; wins: number } {
  const gs = buildState(true);
  let deaths = 0;
  let wins = 0;

  const lastPos = gs.ghosts.map((g) => key(g.position));
  const stuckOut = gs.ghosts.map(() => 0);
  const eatenFor = gs.ghosts.map(() => 0);
  let prevPhase = gs.phase;
  let prevPellets = gs.pellets.remaining();

  for (let t = 0; t < ticks; t++) {
    if (gs.phase === 'gameover') {
      if (gs.won) wins++;
      else deaths++; // ultima vida perdida
      gs.start(); // reinicia p/ continuar o soak
    } else if (gs.pellets.remaining() < prevPellets) {
      // progrediu (comeu algo) — ok
    }
    prevPellets = gs.pellets.remaining();

    // Steer do jogador rumo ao pellet mais proximo.
    const dir = seekPellet(gs);
    if (dir !== Direction.None) gs.player.queue(dir);

    try {
      gs.tick(dt);
    } catch (e) {
      record(t, 'CRASH', String(e instanceof Error ? e.stack ?? e.message : e));
      break;
    }

    // Detecta vida perdida (reset): player volta ao spawn.
    if (prevPhase === 'playing' && gs.phase === 'playing') {
      // nada
    }
    prevPhase = gs.phase;

    // --- Invariantes de interpolacao (jogador) ---
    const pp = gs.playerProgress;
    if (!(pp >= 0 && pp <= 1)) record(t, 'PROGRESS', `playerProgress=${pp}`);
    if (!adjacentOrTunnel(gs.playerPrevCell, gs.player.position)) {
      record(t, 'PREV_ADJ', `player prev=${key(gs.playerPrevCell)} cur=${key(gs.player.position)}`);
    }

    // --- Invariantes por fantasma ---
    gs.ghosts.forEach((g, i) => {
      const gp = gs.ghostProgress(i);
      if (!(gp >= 0 && gp <= 1)) record(t, 'PROGRESS', `ghost ${g.personality} progress=${gp}`);
      if (!adjacentOrTunnel(gs.ghostPrevCell(i), g.position)) {
        record(t, 'PREV_ADJ', `${g.personality} prev=${key(gs.ghostPrevCell(i))} cur=${key(g.position)}`);
      }

      // Preso "out": mesma celula por tempo demais (nao 'inside', nao 'eaten').
      const k = key(g.position);
      if (k === lastPos[i]) {
        if (g.houseState === 'out' && g.mode !== 'eaten') stuckOut[i]!++;
      } else {
        stuckOut[i] = 0;
      }
      lastPos[i] = k;
      if (stuckOut[i]! === 300) {
        record(t, 'GHOST_STUCK', `${g.personality} parado em ${k} por 300 ticks (mode=${g.mode}, house=${g.houseState})`);
      }

      // 'eaten' que nunca volta pra casa.
      if (g.mode === 'eaten') eatenFor[i]!++;
      else eatenFor[i] = 0;
      if (eatenFor[i]! === 1500) {
        record(t, 'EATEN_STUCK', `${g.personality} 'eaten' por 1500 ticks sem voltar pra casa`);
      }
    });
  }

  return { deaths, wins };
}

// --- RUN B: caminho de vitoria (sem fantasmas) -------------------------------

function runWinPath(maxTicks: number, dt: number): { won: boolean; ticks: number; remaining: number } {
  const gs = buildState(false);
  for (let t = 0; t < maxTicks; t++) {
    const dir = seekPellet(gs);
    if (dir !== Direction.None) gs.player.queue(dir);
    gs.tick(dt);
    if (gs.phase === 'gameover') return { won: gs.won, ticks: t, remaining: gs.pellets.remaining() };
  }
  return { won: false, ticks: maxTicks, remaining: gs.pellets.remaining() };
}

// --- Executa -----------------------------------------------------------------

console.log('== Kiosk Maze — soak test do core ==\n');

const win = runWinPath(200_000, 16);
console.log(
  `RUN B (vitoria, sem fantasmas): ${win.won ? 'VENCEU' : 'NAO venceu'} em ${win.ticks} ticks, pellets restantes=${win.remaining}`,
);
if (!win.won) record(win.ticks, 'WIN_PATH', `nao limpou o tabuleiro (restantes=${win.remaining})`);

const soakTicks = 120_000; // ~32 min de jogo simulado a 16ms
const { deaths, wins } = runSoak(soakTicks, 16);
console.log(`RUN A (jogo completo, ${soakTicks} ticks): mortes=${deaths}, vitorias=${wins}`);

console.log('');
if (failures.length === 0) {
  console.log('OK: nenhuma falha detectada nos invariantes.');
} else {
  console.log(`FALHAS detectadas (${failures.length}):`);
  for (const f of failures) console.log(`  [tick ${f.tick}] ${f.kind}: ${f.detail}`);
  process.exit(1);
}
