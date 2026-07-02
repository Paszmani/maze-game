/**
 * GameScene — a ponte entre o core e o Phaser (modulos 4-6).
 *
 * Responsabilidade unica: DESENHAR o estado do core e LER o input. Nenhuma regra
 * de jogo mora aqui — a cena le `state` e pinta; manda as teclas para o player e
 * chama `state.tick(delta)`. Se uma regra precisasse ser tocada aqui, a fronteira
 * core/render teria sido violada.
 *
 * As cores e os numeros de gameplay vem do `Theme` (recebido em `init`), nunca
 * hardcoded. O core recebe so os numeros de gameplay — cores nunca chegam a ele.
 *
 * Render por "snapping" (entidades na celula inteira). Interpolacao suave entre
 * celulas e polimento futuro — nao muda nada no core.
 */

import Phaser from 'phaser';
import { Maze } from '../../core/maze.js';
import { Pellets } from '../../core/pellets.js';
import { Player } from '../../core/player.js';
import { Ghost } from '../../core/ghost-ai.js';
import { GameState } from '../../core/game-state.js';
import { Direction, type Vec2 } from '../../core/direction.js';
import { TouchControls } from '../input/touch-controls.js';
import { isCapacitorNative } from '../../platform/capacitor-kiosk.js';
import { InactivityMonitor, inactivityMs } from '../input/inactivity.js';
import {
  MAZE_LAYOUT,
  PLAYER_SPAWN,
  GHOST_SPAWNS,
  FRUIT_POSITION,
  HOUSE_INTERIOR,
  HOUSE_DOOR,
  HOUSE_EXIT,
} from '../maze-layout.js';
import { TILE, INACTIVITY_MS } from '../constants.js';
import { numberToCss } from '../theme-loader.js';
import { TEX } from '../textures.js';
import type { Theme } from '../../theme/theme-schema.js';
import { DEFAULT_THEME } from '../../theme/default-theme.js';

export class GameScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private state!: GameState;
  private wallsGfx!: Phaser.GameObjects.Graphics;
  // Pellets normais: camada estatica, redesenhada so quando algo e comido.
  private pelletsBaseGfx!: Phaser.GameObjects.Graphics;
  // Power-pellets: camada propria, redesenhada por frame (piscam).
  private pelletsGfx!: Phaser.GameObjects.Graphics;
  private actorsGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private inactivity!: InactivityMonitor;

  // Posicoes coletadas uma vez (evita varrer a grade inteira a cada frame).
  private pelletCells: Vec2[] = [];
  private powerCells: Vec2[] = [];
  // Sprites de pellet/power quando o tema os fornece (senao ficam vazios -> circulos).
  private pelletImgs: Phaser.GameObjects.Image[] = [];
  private powerImgs: Phaser.GameObjects.Image[] = [];
  private lastRemaining = -1;
  private lastHudText = '';
  // Garante que o avanco automatico para a captura de lead arme uma unica vez.
  private leadAdvanceArmed = false;

  // Imagens de sprite, quando o tema as fornece. `null` => desenha forma primitiva.
  private playerImg: Phaser.GameObjects.Image | null = null;
  private ghostImgs: Array<{ img: Phaser.GameObjects.Image | null; base: string }> = [];
  private fruitImg: Phaser.GameObjects.Image | null = null;
  private now = 0;

  constructor() {
    super('game');
  }

  init(): void {
    const theme = this.registry.get('theme') as Theme | undefined;
    if (theme) this.theme = theme;
  }

  create(): void {
    const rows = [...MAZE_LAYOUT];
    const maze = Maze.fromAscii(rows);
    const pellets = Pellets.fromAscii(rows);
    const player = new Player({ ...PLAYER_SPAWN }, Direction.Up);
    const ghosts = GHOST_SPAWNS.map(
      (g) =>
        new Ghost({
          personality: g.personality,
          position: { ...g.position },
          scatterCorner: g.scatterCorner,
          homeTarget: g.homeTarget,
          direction: g.direction,
          mode: 'scatter',
        }),
    );

    // Apenas os numeros de gameplay do tema cruzam a fronteira para o core.
    // `?lives=<n>` permite tuning/teste do numero de vidas.
    const livesOverride = Number(new URLSearchParams(window.location.search).get('lives'));
    this.state = new GameState({
      maze,
      pellets,
      player,
      ghosts,
      config: {
        playerSpeed: this.theme.gameplay.playerSpeed,
        ghostSpeed: this.theme.gameplay.ghostSpeed,
        powerDurationMs: this.theme.gameplay.powerDurationMs,
        fruitPosition: { ...FRUIT_POSITION },
        houseInterior: HOUSE_INTERIOR.map((c) => ({ ...c })),
        houseDoor: { ...HOUSE_DOOR },
        houseExit: { ...HOUSE_EXIT },
        ...(Number.isFinite(livesOverride) && livesOverride > 0 ? { startingLives: livesOverride } : {}),
      },
    });
    this.state.start();

    // Fundo opcional do labirinto (atras de tudo).
    if (this.textures.exists(TEX.mazeBg)) {
      this.add
        .image((maze.width * TILE) / 2, (maze.height * TILE) / 2, TEX.mazeBg)
        .setDisplaySize(maze.width * TILE, maze.height * TILE)
        .setDepth(-1);
    }

    // Reset por (re)create — campos de classe persistem entre restarts da cena.
    this.pelletCells = [];
    this.powerCells = [];
    this.pelletImgs = [];
    this.powerImgs = [];
    this.lastRemaining = -1;
    this.lastHudText = '';

    // Coleta as celulas de pellet/power uma vez; o loop nunca mais varre a grade.
    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        if (this.state.pellets.hasPowerPellet(x, y)) this.powerCells.push({ x, y });
        else if (this.state.pellets.hasPellet(x, y)) this.pelletCells.push({ x, y });
      }
    }

    // Camadas, com profundidade explicita: fundo(-1) < paredes(0) < pellets(1) <
    // atores primitivos(2) < sprites de ator(5) < HUD(10) < popups(20) < overlay(30).
    this.wallsGfx = this.add.graphics();
    this.drawWalls();
    this.pelletsBaseGfx = this.add.graphics().setDepth(1);
    this.pelletsGfx = this.add.graphics().setDepth(1);

    // Sprites de pellet/power do tema (quando houver): substituem os circulos.
    if (this.textures.exists(TEX.pellet)) {
      this.pelletImgs = this.pelletCells.map((c) =>
        this.add.image(this.center(c.x), this.center(c.y), TEX.pellet).setDisplaySize(TILE * 0.5, TILE * 0.5).setDepth(1),
      );
    }
    if (this.textures.exists(TEX.power)) {
      this.powerImgs = this.powerCells.map((c) =>
        this.add.image(this.center(c.x), this.center(c.y), TEX.power).setDisplaySize(TILE * 0.9, TILE * 0.9).setDepth(1),
      );
    }

    this.actorsGfx = this.add.graphics().setDepth(2);

    // Sprites dos personagens, quando existirem; senao ficam null (forma primitiva).
    const sprite = (key: string): Phaser.GameObjects.Image | null =>
      this.textures.exists(key)
        ? this.add.image(0, 0, key).setDisplaySize(TILE * 0.95, TILE * 0.95).setDepth(5)
        : null;
    this.playerImg = sprite(TEX.player);
    this.ghostImgs = ghosts.map((gh) => ({ img: sprite(TEX.ghost(gh.personality)), base: TEX.ghost(gh.personality) }));
    this.fruitImg = sprite(TEX.fruit);
    this.fruitImg?.setVisible(false);

    this.hud = this.add.text(8, maze.height * TILE + 12, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: this.theme.colors.text,
    }).setDepth(10);

    this.overlay = this.add
      .text(this.scale.width / 2, (maze.height * TILE) / 2, '', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: this.theme.colors.text,
        align: 'center',
        backgroundColor: numberToCss(this.theme.colors.background) + 'cc',
      })
      .setOrigin(0.5)
      .setPadding(16)
      .setDepth(30)
      .setVisible(false);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('GameScene: teclado indisponivel.');
    this.cursors = keyboard.createCursorKeys();

    // Swipe em qualquer plataforma; d-pad on-screen SO no Android.
    // Auto-registra os listeners na cena — nao precisa guardar a referencia.
    new TouchControls(this, (dir) => this.state.player.queue(dir), { showDpad: isCapacitorNative() });

    // Reset por inatividade cobre quem larga o totem ANTES de terminar a partida.
    this.inactivity = new InactivityMonitor(this, inactivityMs(INACTIVITY_MS), () => this.scene.start('attract'));
    this.leadAdvanceArmed = false;
  }

  override update(time: number, delta: number): void {
    this.now = time;
    this.readInput();

    if (this.state.phase === 'playing') {
      this.inactivity.update();
      this.state.tick(delta);
    } else if (this.state.phase === 'gameover' && !this.leadAdvanceArmed) {
      // Fim de jogo (vitoria OU derrota): mostra o resultado um instante e segue
      // direto para a captura de lead — sem "toque para continuar", sem como pular.
      this.leadAdvanceArmed = true;
      this.time.delayedCall(1600, () => this.scene.start('lead', { score: this.state.score }));
    }

    this.drawPellets();
    this.drawPowerPellets();
    this.drawActors();
    this.drawFruit();
    this.drawHud();
    this.spawnPopups();
  }

  // --- Fruta e popups ----------------------------------------------------

  private drawFruit(): void {
    const fruit = this.state.fruit;
    if (this.fruitImg) {
      if (fruit) this.fruitImg.setVisible(true).setPosition(this.center(fruit.position.x), this.center(fruit.position.y));
      else this.fruitImg.setVisible(false);
    } else if (fruit) {
      // Sem sprite: desenha um coletavel primitivo (no actorsGfx, ja limpo neste frame).
      this.actorsGfx.fillStyle(this.theme.colors.power, 1);
      this.actorsGfx.fillCircle(this.center(fruit.position.x), this.center(fruit.position.y), TILE * 0.3);
      this.actorsGfx.lineStyle(2, this.theme.colors.uiAccent, 1);
      this.actorsGfx.strokeCircle(this.center(fruit.position.x), this.center(fruit.position.y), TILE * 0.3);
    }
  }

  /** Texto "+N" subindo e sumindo ao comer fruta/fantasma. */
  private spawnPopups(): void {
    for (const popup of this.state.drainPopups()) {
      const text = this.add
        .text(this.center(popup.position.x), this.center(popup.position.y), `+${popup.value}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: this.theme.colors.text,
        })
        .setOrigin(0.5)
        .setDepth(20);
      this.tweens.add({
        targets: text,
        y: text.y - TILE,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy(),
      });
    }
  }

  // --- Input -------------------------------------------------------------

  private readInput(): void {
    if (this.cursors.up.isDown) this.state.player.queue(Direction.Up);
    else if (this.cursors.down.isDown) this.state.player.queue(Direction.Down);
    else if (this.cursors.left.isDown) this.state.player.queue(Direction.Left);
    else if (this.cursors.right.isDown) this.state.player.queue(Direction.Right);
  }

  // --- Desenho -----------------------------------------------------------

  private center(cell: number): number {
    return cell * TILE + TILE / 2;
  }

  private drawWalls(): void {
    const g = this.wallsGfx;
    g.fillStyle(this.theme.colors.maze, 1);
    for (let y = 0; y < this.state.maze.height; y++) {
      for (let x = 0; x < this.state.maze.width; x++) {
        if (this.state.maze.isWall(x, y)) {
          g.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    this.drawHouseDoor();
  }

  /** Barra da porta da casa dos fantasmas — leitura visual da "caixa fisica". */
  private drawHouseDoor(): void {
    const g = this.wallsGfx;
    const { x, y } = HOUSE_DOOR;
    const w = TILE * 0.8;
    const h = Math.max(3, TILE * 0.16);
    g.fillStyle(this.theme.colors.frightened, 1);
    g.fillRect(x * TILE + (TILE - w) / 2, y * TILE + TILE - h, w, h);
  }

  /**
   * Pellets normais: camada estatica. So redesenha quando a contagem muda (algo
   * foi comido ou a fase reiniciou) — entre comidas, custo zero por frame, em vez
   * de varrer 361 celulas e preencher ~218 circulos a cada quadro.
   */
  private drawPellets(): void {
    const remaining = this.state.pellets.remaining();
    if (remaining === this.lastRemaining) return;
    this.lastRemaining = remaining;
    // Com sprite: so alterna a visibilidade das imagens (o tema desenha o pellet).
    if (this.pelletImgs.length > 0) {
      this.pelletCells.forEach((c, i) => this.pelletImgs[i]!.setVisible(this.state.pellets.hasPellet(c.x, c.y)));
      return;
    }
    const g = this.pelletsBaseGfx;
    g.clear();
    g.fillStyle(this.theme.colors.pellet, 1);
    for (const c of this.pelletCells) {
      if (this.state.pellets.hasPellet(c.x, c.y)) g.fillCircle(this.center(c.x), this.center(c.y), TILE * 0.12);
    }
  }

  /** Power-pellets (so 4): piscam. Usa sprite do tema se houver, senao circulos. */
  private drawPowerPellets(): void {
    const show = this.now % 400 < 280; // fase acesa do pisca
    if (this.powerImgs.length > 0) {
      this.powerCells.forEach((c, i) => this.powerImgs[i]!.setVisible(show && this.state.pellets.hasPowerPellet(c.x, c.y)));
      return;
    }
    const g = this.pelletsGfx;
    g.clear();
    if (!show) return;
    g.fillStyle(this.theme.colors.power, 1);
    for (const c of this.powerCells) {
      if (this.state.pellets.hasPowerPellet(c.x, c.y)) g.fillCircle(this.center(c.x), this.center(c.y), TILE * 0.32);
    }
  }

  /**
   * Pixel interpolado deslizando de `from` para `to` conforme `progress` (0..1).
   *
   * - Fantasmas usam ARRASTE (from=celula anterior, to=atual): so mostram passos
   *   ja commitados — nunca "estouram" a curva.
   * - O jogador usa PREDICAO (from=atual, to=`peekNext`): desliza ja rumo a celula
   *   correta do proximo passo, sem a latencia de ~1 passo do arraste (era o
   *   "delay" sentido) e sem overshoot (o alvo ja e o certo).
   *
   * Em salto de tunel (celulas nao-adjacentes) faz snap para `snapTo` — 'to' no
   * arraste (o fantasma ja cruzou) e 'from' na predicao (o jogador ainda nao).
   */
  private lerpCells(from: Vec2, to: Vec2, progress: number, snapTo: 'from' | 'to' = 'to'): { x: number; y: number } {
    const fx = this.center(from.x);
    const fy = this.center(from.y);
    const tx = this.center(to.x);
    const ty = this.center(to.y);
    if (from.x === to.x && from.y === to.y) return { x: tx, y: ty };
    if (Math.abs(to.x - from.x) > 1 || Math.abs(to.y - from.y) > 1) {
      return snapTo === 'from' ? { x: fx, y: fy } : { x: tx, y: ty };
    }
    if (progress >= 1) return { x: tx, y: ty };
    return { x: fx + (tx - fx) * progress, y: fy + (ty - fy) * progress };
  }

  private dirAngle(dir: Direction): number {
    if (dir === Direction.Down) return 90;
    if (dir === Direction.Left) return 180;
    if (dir === Direction.Up) return 270;
    return 0;
  }

  private drawActors(): void {
    const g = this.actorsGfx;
    g.clear();

    // Jogador (posicao interpolada por arraste prev -> atual). Sumido na morte.
    const player = this.state.player;
    if (this.state.isDying) {
      this.playerImg?.setVisible(false);
    } else {
      const pp = this.lerpCells(this.state.playerPrevCell, player.position, this.state.playerProgress);
      if (this.playerImg) {
        this.playerImg.setVisible(true).setPosition(pp.x, pp.y).setAngle(this.dirAngle(player.direction));
      } else {
        this.drawPacman(pp.x, pp.y, player.direction);
      }
    }

    this.state.ghosts.forEach((ghost, i) => {
      let pos = this.lerpCells(this.state.ghostPrevCell(i), ghost.position, this.state.ghostProgress(i));
      // Bob vertical enquanto espera na casa.
      if (ghost.houseState === 'inside') {
        pos = { x: this.center(ghost.position.x), y: this.center(ghost.position.y) + Math.sin(this.now * 0.005) * 3 };
      }
      const flash = ghost.mode === 'frightened' && this.state.frightenedRemainingMs < 2000 && this.now % 250 < 125;
      const ref = this.ghostImgs[i];

      if (ref?.img) {
        ref.img.setPosition(pos.x, pos.y).setVisible(true).setAlpha(1).clearTint();
        if (ghost.mode === 'frightened') {
          if (this.textures.exists(TEX.frightened)) ref.img.setTexture(TEX.frightened);
          else ref.img.setTexture(ref.base).setTint(flash ? 0xffffff : this.theme.colors.frightened);
        } else {
          ref.img.setTexture(ref.base);
          if (ghost.mode === 'eaten') ref.img.setAlpha(0.4);
        }
      } else {
        const color =
          ghost.mode === 'frightened'
            ? flash
              ? 0xffffff
              : this.theme.colors.frightened
            : ghost.mode === 'eaten'
              ? this.theme.colors.eaten
              : this.theme.colors.ghosts[ghost.personality];
        g.fillStyle(color, 1);
        g.fillCircle(pos.x, pos.y, TILE * 0.42);
      }
    });
  }

  /** Pac-Man primitivo com boca animada, apontando na direcao do movimento. */
  private drawPacman(x: number, y: number, dir: Direction): void {
    const g = this.actorsGfx;
    const r = TILE * 0.42;
    const open = (Math.sin(this.now * 0.012) + 1) / 2; // 0..1
    const mouth = Phaser.Math.DegToRad(6 + open * 34);
    const a = Phaser.Math.DegToRad(this.dirAngle(dir));
    g.fillStyle(this.theme.colors.player, 1);
    g.slice(x, y, r, a + mouth, a + Math.PI * 2 - mouth, false);
    g.fillPath();
  }

  private drawHud(): void {
    const fright = this.state.isFrightened ? '  [FRIGHTENED]' : '';
    const text = `SCORE ${this.state.score}    VIDAS ${this.state.lives}${fright}`;
    if (text !== this.lastHudText) {
      this.lastHudText = text;
      this.hud.setText(text);
    }

    if (this.state.phase === 'gameover') {
      const msg = this.state.won ? 'VOCE VENCEU!' : 'FIM DE JOGO';
      this.overlay.setText(msg).setVisible(true);
    } else if (this.state.isReady) {
      this.overlay.setText('PRONTO!').setVisible(true);
    } else {
      this.overlay.setVisible(false);
    }
  }
}
