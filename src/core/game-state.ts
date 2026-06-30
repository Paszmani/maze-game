/**
 * Maquina de estados e laco de jogo — o orquestrador do core.
 *
 * E o unico modulo que conhece o tempo. Recebe `tick(dtMs)` do render a cada
 * frame e converte tempo real em passos discretos de grid: o jogador anda uma
 * celula a cada `playerInterval`, cada fantasma conforme sua velocidade/modo.
 * Tambem cuida do que os modulos puros deixaram de fora de proposito:
 *
 *   - dirige o cronograma scatter/chase e comanda as meia-voltas nas viradas;
 *   - cronometra o frightened (e pausa o cronograma enquanto ele dura);
 *   - resolve colisoes jogador x fantasma (comer / morrer);
 *   - conta vidas, vida-extra, e decide vitoria (pellets zerados) e game over.
 *
 * Fases: attract -> playing -> gameover. O reset por inatividade (voltar ao
 * attract) e responsabilidade do render, que chama `toAttract()`.
 */

import { Direction, equalsVec, type Vec2 } from './direction.js';
import type { Maze } from './maze.js';
import type { Player } from './player.js';
import { type Ghost, type Personality } from './ghost-ai.js';
import { ScatterChaseSchedule, type BaseMode } from './ghost-modes.js';
import { Pellets } from './pellets.js';
import { Scoring } from './scoring.js';
import type { Rng } from './ghost-ai.js';

export type GamePhase = 'attract' | 'playing' | 'gameover';

export interface GameConfig {
  startingLives: number;
  /** Duracao do frightened apos uma power-pellet (ms). Vem de theme.gameplay. */
  powerDurationMs: number;
  /** Tempo-base para o jogador andar uma celula (ms) a velocidade 1.0. */
  baseStepMs: number;
  playerSpeed: number;
  ghostSpeed: number;
  /** Fator (<1) que deixa o fantasma mais lento durante o frightened. */
  frightenedSpeedFactor: number;
  /** Pontuacao que concede uma vida extra (uma unica vez). `null` desativa. */
  extraLifeAt: number | null;
  /** Dots comidos para liberar cada fantasma da casa (regra do arcade). */
  dotLimits: Record<Personality, number>;
  /** Sem comer dot por este tempo, libera o proximo fantasma (anti-trava). */
  releaseFallbackMs: number;
  /** Fator (<1) que deixa o fantasma mais lento dentro do tunel. */
  tunnelSpeedFactor: number;
  /** Cruise Elroy: Blinky acelera quando faltam <= elroyDots1 / <= elroyDots2. */
  elroyDots1: number;
  elroyDots2: number;
  elroySpeed1: number;
  elroySpeed2: number;
  /** Dots (do nivel) que fazem a fruta aparecer (classico: 70 e 170). */
  fruitDotThresholds: number[];
  /** Quanto tempo a fruta fica visivel antes de sumir (ms). */
  fruitDurationMs: number;
  /** Pontos da fruta. */
  fruitValue: number;
  /** Onde a fruta aparece (classico: logo abaixo da casa). */
  fruitPosition: Vec2;
  schedule: ScatterChaseSchedule;
}

/** Popup de pontuacao para o render desenhar (ao comer fruta ou fantasma). */
export interface ScorePopup {
  value: number;
  position: Vec2;
}

export const DEFAULT_CONFIG: Omit<GameConfig, 'schedule'> = {
  startingLives: 3,
  powerDurationMs: 6_000,
  baseStepMs: 150,
  playerSpeed: 1.0,
  ghostSpeed: 0.9,
  frightenedSpeedFactor: 0.6,
  extraLifeAt: 10_000,
  // Blinky e Pinky comecam fora; Inky sai aos 30 dots, Clyde aos 60.
  dotLimits: { blinky: 0, pinky: 0, inky: 30, clyde: 60 },
  releaseFallbackMs: 4_000,
  tunnelSpeedFactor: 0.5,
  elroyDots1: 20,
  elroyDots2: 10,
  elroySpeed1: 1.05,
  elroySpeed2: 1.1,
  fruitDotThresholds: [70, 170],
  fruitDurationMs: 9_500,
  fruitValue: 100,
  fruitPosition: { x: 9, y: 11 },
};

/**
 * Velocidade efetiva de um fantasma (fracao da base), pura e testavel:
 * frightened mais lento, olhos (eaten) bem rapidos, Blinky em Cruise Elroy
 * acelera quando faltam poucos dots, e todos (menos olhos) lentos no tunel.
 */
export function effectiveGhostSpeed(
  config: Pick<
    GameConfig,
    'ghostSpeed' | 'frightenedSpeedFactor' | 'tunnelSpeedFactor' | 'elroyDots1' | 'elroyDots2' | 'elroySpeed1' | 'elroySpeed2'
  >,
  ghost: Pick<Ghost, 'mode' | 'personality'>,
  pelletsRemaining: number,
  inTunnel: boolean,
): number {
  let speed = config.ghostSpeed;
  if (ghost.mode === 'frightened') {
    speed = config.ghostSpeed * config.frightenedSpeedFactor;
  } else if (ghost.mode === 'eaten') {
    speed = config.ghostSpeed * 2;
  } else if (ghost.personality === 'blinky') {
    if (pelletsRemaining <= config.elroyDots2) speed *= config.elroySpeed2;
    else if (pelletsRemaining <= config.elroyDots1) speed *= config.elroySpeed1;
  }
  if (ghost.mode !== 'eaten' && inTunnel) speed *= config.tunnelSpeedFactor;
  return speed;
}

export interface GameStateInit {
  maze: Maze;
  pellets: Pellets;
  player: Player;
  ghosts: Ghost[];
  config?: Partial<GameConfig>;
  rng?: Rng;
}

interface PlayerSpawn {
  position: Vec2;
  direction: Direction;
}
interface GhostSpawn {
  position: Vec2;
  direction: Direction;
  mode: Ghost['mode'];
}

export class GameState {
  readonly maze: Maze;
  readonly pellets: Pellets;
  readonly player: Player;
  readonly ghosts: Ghost[];
  readonly scoring = new Scoring();
  readonly config: GameConfig;

  phase: GamePhase = 'attract';
  lives: number;
  won = false;
  frightenedRemainingMs = 0;

  private readonly rng: Rng;
  private scheduleElapsedMs = 0;
  private extraLifeAwarded = false;
  private resetPending = false;

  // Casa dos fantasmas: contador de dots, timer de fallback e quem voltou comido.
  private dotsEaten = 0;
  private releaseTimerMs = 0;
  private readonly returned = new Set<Personality>();

  // Fruta: dots totais do nivel (persistem entre mortes), estado e popups.
  private totalDots = 0;
  private fruitActive = false;
  private fruitRemainingMs = 0;
  private fruitSpawnedCount = 0;
  private pendingPopups: ScorePopup[] = [];

  private playerAcc = 0;
  private ghostAccs: number[];

  private readonly playerInterval: number;

  private readonly playerSpawn: PlayerSpawn;
  private readonly ghostSpawns: GhostSpawn[];

  constructor(init: GameStateInit) {
    this.maze = init.maze;
    this.pellets = init.pellets;
    this.player = init.player;
    this.ghosts = init.ghosts;
    this.rng = init.rng ?? Math.random;

    this.config = {
      ...DEFAULT_CONFIG,
      schedule: new ScatterChaseSchedule(),
      ...init.config,
    };
    this.lives = this.config.startingLives;

    this.playerInterval = this.config.baseStepMs / this.config.playerSpeed;

    this.playerSpawn = { position: { ...this.player.position }, direction: this.player.direction };
    this.ghostSpawns = this.ghosts.map((g) => ({
      position: { ...g.position },
      direction: g.direction,
      mode: g.mode,
    }));
    this.ghostAccs = this.ghosts.map(() => 0);
  }

  get score(): number {
    return this.scoring.score;
  }

  get isFrightened(): boolean {
    return this.frightenedRemainingMs > 0;
  }

  /** Total de dots (pellets + power) comidos na vida atual. */
  get dots(): number {
    return this.dotsEaten;
  }

  /** Fruta ativa (posicao + valor) ou `null`. O render desenha; o teste verifica. */
  get fruit(): { position: Vec2; value: number } | null {
    return this.fruitActive ? { position: this.config.fruitPosition, value: this.config.fruitValue } : null;
  }

  /** Devolve e limpa os popups de pontuacao pendentes (o render os consome). */
  drainPopups(): ScorePopup[] {
    const out = this.pendingPopups;
    this.pendingPopups = [];
    return out;
  }

  // --- Transicoes de fase ------------------------------------------------

  /** Inicia uma partida nova: zera tudo e vai para `playing`. */
  start(): void {
    this.phase = 'playing';
    this.won = false;
    this.lives = this.config.startingLives;
    this.extraLifeAwarded = false;
    this.scoring.reset();
    this.pellets.reset();
    this.totalDots = this.pellets.remaining();
    this.fruitSpawnedCount = 0;
    this.pendingPopups = [];
    this.frightenedRemainingMs = 0;
    this.scheduleElapsedMs = 0;
    this.resetEntities();
  }

  toAttract(): void {
    this.phase = 'attract';
  }

  // --- Laco principal ----------------------------------------------------

  tick(dtMs: number): void {
    if (this.phase !== 'playing') return;
    this.resetPending = false;

    this.advanceFrightened(dtMs);
    this.advanceSchedule(dtMs);
    this.updateHouse(dtMs);
    this.updateFruit(dtMs);

    this.movePlayer(dtMs);
    if (this.phase !== 'playing' || this.resetPending) return;

    this.moveGhosts(dtMs);
  }

  // --- Casa dos fantasmas (liberacao escalonada) -------------------------

  /**
   * Libera no maximo um fantasma por tick, na ordem da fila, quando seu limite de
   * dots e atingido — ou pelo fallback de tempo (sem comer dot por X ms), que
   * evita a casa travar. Fantasma que voltou comido (`returned`) sai imediato.
   */
  private updateHouse(dtMs: number): void {
    this.releaseTimerMs += dtMs;
    const order: ReadonlyArray<Personality> = ['blinky', 'pinky', 'inky', 'clyde'];
    for (const p of order) {
      const g = this.ghosts.find((gh) => gh.personality === p);
      if (!g || g.houseState !== 'inside') continue;
      // Primeiro da fila esperando: libera se pronto, e para por aqui (um por vez).
      const ready =
        this.returned.has(p) ||
        this.dotsEaten >= this.config.dotLimits[p] ||
        this.releaseTimerMs >= this.config.releaseFallbackMs;
      if (ready) {
        g.houseState = 'out';
        g.mode = this.currentBaseMode();
        this.returned.delete(p);
        this.releaseTimerMs = 0;
      }
      break;
    }
  }

  // --- Fruta (coletavel bonus) -------------------------------------------

  private updateFruit(dtMs: number): void {
    if (this.fruitActive) {
      this.fruitRemainingMs -= dtMs;
      if (this.fruitRemainingMs <= 0) this.fruitActive = false; // expirou
    }
    // Dots do nivel (persistem entre mortes) atingiram o proximo limiar?
    const levelDots = this.totalDots - this.pellets.remaining();
    const next = this.config.fruitDotThresholds[this.fruitSpawnedCount];
    if (next !== undefined && levelDots >= next) {
      this.fruitActive = true;
      this.fruitRemainingMs = this.config.fruitDurationMs;
      this.fruitSpawnedCount += 1;
    }
  }

  // --- Tempo: frightened e cronograma ------------------------------------

  private currentBaseMode(): BaseMode {
    return this.config.schedule.modeAt(this.scheduleElapsedMs);
  }

  private advanceFrightened(dtMs: number): void {
    if (this.frightenedRemainingMs <= 0) return;
    this.frightenedRemainingMs -= dtMs;
    if (this.frightenedRemainingMs > 0) return;

    this.frightenedRemainingMs = 0;
    this.scoring.resetGhostChain();
    const base = this.currentBaseMode();
    for (const g of this.ghosts) {
      if (g.mode === 'frightened') g.setMode(base);
    }
  }

  /** O cronograma fica congelado enquanto o frightened dura (regra classica). */
  private advanceSchedule(dtMs: number): void {
    if (this.frightenedRemainingMs > 0) return;
    const before = this.currentBaseMode();
    this.scheduleElapsedMs += dtMs;
    const after = this.currentBaseMode();
    if (after === before) return;
    for (const g of this.ghosts) {
      if (g.houseState === 'out' && (g.mode === 'scatter' || g.mode === 'chase')) g.setMode(after);
    }
  }

  private enterFrightened(): void {
    this.frightenedRemainingMs = this.config.powerDurationMs;
    this.scoring.resetGhostChain();
    for (const g of this.ghosts) {
      // Fantasma dentro da casa nao fica assustado.
      if (g.houseState === 'out' && (g.mode === 'scatter' || g.mode === 'chase')) g.setMode('frightened');
    }
  }

  // --- Movimento ---------------------------------------------------------

  private movePlayer(dtMs: number): void {
    this.playerAcc += dtMs;
    while (this.playerAcc >= this.playerInterval) {
      this.playerAcc -= this.playerInterval;
      this.player.update(this.maze);
      this.eatAtPlayer();
      if (this.phase !== 'playing') return;
      this.checkCollisions();
      if (this.phase !== 'playing' || this.resetPending) return;
    }
  }

  private ghostInterval(g: Ghost): number {
    const inTunnel = this.maze.isTunnel(g.position.x, g.position.y);
    return this.config.baseStepMs / effectiveGhostSpeed(this.config, g, this.pellets.remaining(), inTunnel);
  }

  private moveGhosts(dtMs: number): void {
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i]!;
      if (g.houseState === 'inside') continue; // esperando na casa: nao se move
      let acc = this.ghostAccs[i]! + dtMs;
      while (acc >= this.ghostInterval(g)) {
        acc -= this.ghostInterval(g);
        const blinky = this.ghosts.find((other) => other.personality === 'blinky')?.position
          ?? this.player.position;
        g.update(
          this.maze,
          { pacman: this.player.position, pacmanDir: this.player.direction, blinky },
          this.rng,
        );
        if (g.mode === 'eaten' && equalsVec(g.position, g.homeTarget)) {
          // Voltou comido para a casa: vira a esperar e e re-liberado pelo mecanismo.
          g.houseState = 'inside';
          this.returned.add(g.personality);
          g.mode = this.currentBaseMode();
          this.ghostAccs[i] = 0;
          break;
        }
        this.checkCollisions();
        if (this.phase !== 'playing' || this.resetPending) {
          this.ghostAccs[i] = acc;
          return;
        }
      }
      this.ghostAccs[i] = acc;
    }
  }

  // --- Comer e colidir ---------------------------------------------------

  private eatAtPlayer(): void {
    const { x, y } = this.player.position;
    const kind = this.pellets.consume(x, y);
    if (kind === 'pellet' || kind === 'power') {
      this.dotsEaten += 1;
      this.releaseTimerMs = 0; // comeu dot -> reseta o fallback de tempo
    }
    if (kind === 'pellet') this.scoring.eatPellet();
    else if (kind === 'power') {
      this.scoring.eatPowerPellet();
      this.enterFrightened();
    }
    // Fruta na celula do jogador.
    if (this.fruitActive && equalsVec(this.player.position, this.config.fruitPosition)) {
      this.scoring.score += this.config.fruitValue;
      this.pendingPopups.push({ value: this.config.fruitValue, position: { ...this.config.fruitPosition } });
      this.fruitActive = false;
    }
    this.checkExtraLife();
    if (this.pellets.isCleared()) {
      this.phase = 'gameover';
      this.won = true;
    }
  }

  private checkCollisions(): void {
    for (const g of this.ghosts) {
      if (!equalsVec(this.player.position, g.position)) continue;
      if (g.mode === 'frightened') {
        const pts = this.scoring.eatGhost();
        this.pendingPopups.push({ value: pts, position: { ...g.position } });
        g.setMode('eaten');
      } else if (g.mode === 'eaten') {
        // So os olhos voltando para casa — nao machuca ninguem.
        continue;
      } else {
        this.loseLife();
        return;
      }
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.frightenedRemainingMs = 0;
    this.scoring.resetGhostChain();
    if (this.lives <= 0) {
      this.phase = 'gameover';
      this.won = false;
      return;
    }
    this.resetEntities();
    this.resetPending = true;
  }

  private checkExtraLife(): void {
    if (this.config.extraLifeAt === null || this.extraLifeAwarded) return;
    if (this.scoring.score >= this.config.extraLifeAt) {
      this.lives += 1;
      this.extraLifeAwarded = true;
    }
  }

  private resetEntities(): void {
    this.player.position = { ...this.playerSpawn.position };
    this.player.direction = this.playerSpawn.direction;
    this.player.desired = Direction.None;
    this.ghosts.forEach((g, i) => {
      const spawn = this.ghostSpawns[i]!;
      g.position = { ...spawn.position };
      g.direction = spawn.direction;
      g.mode = spawn.mode;
      // Limite 0 (Blinky/Pinky) comeca fora; os demais esperam na casa.
      g.houseState = this.config.dotLimits[g.personality] === 0 ? 'out' : 'inside';
    });
    // A casa reinicia a cada vida: zera dots/timer e quem havia voltado comido.
    this.dotsEaten = 0;
    this.releaseTimerMs = 0;
    this.returned.clear();
    // Fruta ativa some ao perder a vida (mas o contador de nivel persiste).
    this.fruitActive = false;
    this.playerAcc = 0;
    this.ghostAccs = this.ghosts.map(() => 0);
  }
}
