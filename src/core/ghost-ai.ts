/**
 * IA de perseguicao dos fantasmas — o coracao tecnico do jogo.
 *
 * Cada fantasma decide para onde virar em cada celula por uma regra greedy:
 * dentre as direcoes validas (sem dar meia-volta), escolhe a que minimiza a
 * distancia ate um *alvo*. O que muda entre os quatro fantasmas e so o alvo:
 *
 *   - blinky: a propria celula do Pac-Man (perseguicao direta).
 *   - pinky:  4 celulas a frente do Pac-Man (tenta emboscar).
 *   - inky:   vetor de blinky espelhado 2 celulas a frente do Pac-Man.
 *   - clyde:  o Pac-Man se estiver longe (>8); seu canto se estiver perto (timido).
 *
 * Em scatter, todos miram seu canto fixo. Em frightened, ignoram o alvo e andam
 * aleatoriamente (RNG injetado — determinismo total nos testes). Em eaten, voltam
 * para a casa. Nada aqui sabe o que e um pixel.
 */

import {
  Direction,
  OPPOSITE,
  ahead,
  dist2,
  type Vec2,
} from './direction.js';
import type { Maze } from './maze.js';
import type { GhostMode } from './ghost-modes.js';

export type Personality = 'blinky' | 'pinky' | 'inky' | 'clyde';

/**
 * Estado em relacao a casa dos fantasmas: `inside` = esperando ser liberado
 * (nao roda IA, fica parado/bob); `out` = solto no labirinto rodando a IA.
 * O game-state controla a transicao (contador de dots / fallback de tempo).
 */
export type HouseState = 'inside' | 'out';

/** Fonte de aleatoriedade: retorna [0, 1). Injetavel para testes determinísticos. */
export type Rng = () => number;

/** Contexto que a IA le do mundo para mirar. Tudo em celulas. */
export interface ChaseContext {
  readonly pacman: Vec2;
  readonly pacmanDir: Direction;
  /** Posicao do blinky — usada pelo alvo do inky. */
  readonly blinky: Vec2;
}

/**
 * Ordem de preferencia classica para desempate: cima, esquerda, baixo, direita.
 * Quando dois caminhos empatam em distancia, o primeiro desta lista vence.
 */
const PREFERENCE: ReadonlyArray<Direction> = [
  Direction.Up,
  Direction.Left,
  Direction.Down,
  Direction.Right,
];

const CLYDE_SHY_RADIUS = 8;

/** Direcoes validas a partir de `pos`, na ordem de preferencia, sem a meia-volta. */
function candidateDirections(maze: Maze, pos: Vec2, current: Direction): Direction[] {
  const reverse = OPPOSITE[current];
  const open = PREFERENCE.filter((dir) => maze.step(pos, dir) !== null);
  const forward = open.filter((dir) => dir !== reverse);
  // Beco sem saida: se a unica saida e dar meia-volta, permite-a.
  return forward.length > 0 ? forward : open;
}

/** Alvo de chase para a personalidade. Pode cair fora do grid — e so um ponto. */
export function chaseTarget(
  personality: Personality,
  ghost: Pick<Ghost, 'position' | 'scatterCorner'>,
  ctx: ChaseContext,
): Vec2 {
  switch (personality) {
    case 'blinky':
      return ctx.pacman;
    case 'pinky':
      // 4 celulas a frente do Pac-Man. NAO replicamos o "bug do up" do arcade
      // (quando o Pac-Man olha pra cima, o alvo iria 4 acima + 4 a esquerda):
      // para um jogo de evento, previsivel e justo e melhor que fiel ao bug.
      return ahead(ctx.pacman, ctx.pacmanDir, 4);
    case 'inky': {
      const pivot = ahead(ctx.pacman, ctx.pacmanDir, 2);
      return { x: 2 * pivot.x - ctx.blinky.x, y: 2 * pivot.y - ctx.blinky.y };
    }
    case 'clyde':
      return dist2(ghost.position, ctx.pacman) > CLYDE_SHY_RADIUS * CLYDE_SHY_RADIUS
        ? ctx.pacman
        : ghost.scatterCorner;
  }
}

/**
 * Direcao greedy: escolhe a saida cuja celula resultante fica mais perto do alvo.
 * Empates resolvidos pela ordem de preferencia. Retorna `None` so se nao houver
 * saida nenhuma (encurralado).
 */
export function chooseDirection(
  maze: Maze,
  pos: Vec2,
  current: Direction,
  target: Vec2,
): Direction {
  const candidates = candidateDirections(maze, pos, current);
  if (candidates.length === 0) return Direction.None;

  let best: Direction = candidates[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const dir of candidates) {
    const cell = maze.step(pos, dir)!;
    const d = dist2(cell, target);
    if (d < bestDist) {
      bestDist = d;
      best = dir;
    }
  }
  return best;
}

/** Movimento frightened: direcao aleatoria entre as validas (sem meia-volta). */
export function chooseFrightenedDirection(
  maze: Maze,
  pos: Vec2,
  current: Direction,
  rng: Rng,
): Direction {
  const candidates = candidateDirections(maze, pos, current);
  if (candidates.length === 0) return Direction.None;
  const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[idx]!;
}

/**
 * Regra de meia-volta forcada do classico: ao trocar de modo, o fantasma inverte
 * a direcao — exceto saindo/entrando de `eaten`, e exceto quando o frightened
 * *termina* (o fantasma simplesmente retoma a perseguicao sem se virar).
 */
export function shouldReverse(from: GhostMode, to: GhostMode): boolean {
  if (from === to) return false;
  if (from === 'eaten' || to === 'eaten') return false;
  if (to === 'frightened') return from === 'scatter' || from === 'chase';
  if (from === 'frightened') return false;
  return true; // scatter <-> chase
}

export interface GhostInit {
  readonly personality: Personality;
  readonly position: Vec2;
  readonly scatterCorner: Vec2;
  /** Celula-alvo ao voltar para casa apos ser comido. */
  readonly homeTarget: Vec2;
  readonly direction?: Direction;
  readonly mode?: GhostMode;
  readonly houseState?: HouseState;
}

export class Ghost {
  readonly personality: Personality;
  position: Vec2;
  direction: Direction;
  mode: GhostMode;
  /** `inside` enquanto espera na casa; `out` quando solto. Default `out`. */
  houseState: HouseState;
  readonly scatterCorner: Vec2;
  readonly homeTarget: Vec2;

  constructor(init: GhostInit) {
    this.personality = init.personality;
    this.position = init.position;
    this.direction = init.direction ?? Direction.None;
    this.mode = init.mode ?? 'scatter';
    this.houseState = init.houseState ?? 'out';
    this.scatterCorner = init.scatterCorner;
    this.homeTarget = init.homeTarget;
  }

  /** Troca de modo aplicando a meia-volta forcada quando a regra manda. */
  setMode(mode: GhostMode): void {
    if (shouldReverse(this.mode, mode)) {
      this.direction = OPPOSITE[this.direction];
    }
    this.mode = mode;
  }

  /** Alvo atual conforme o modo. Frightened nao tem alvo (movimento aleatorio). */
  target(ctx: ChaseContext): Vec2 | null {
    switch (this.mode) {
      case 'scatter':
        return this.scatterCorner;
      case 'chase':
        return chaseTarget(this.personality, this, ctx);
      case 'eaten':
        return this.homeTarget;
      case 'frightened':
        return null;
    }
  }

  /** Avanca uma celula segundo o modo atual. */
  update(maze: Maze, ctx: ChaseContext, rng: Rng): void {
    const dir =
      this.mode === 'frightened'
        ? chooseFrightenedDirection(maze, this.position, this.direction, rng)
        : chooseDirection(maze, this.position, this.direction, this.target(ctx)!);

    if (dir === Direction.None) return;
    const next = maze.step(this.position, dir);
    if (next) {
      this.position = next;
      this.direction = dir;
    }
  }
}
