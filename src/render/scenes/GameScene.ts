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
import { Direction } from '../../core/direction.js';
import { TouchControls } from '../input/touch-controls.js';
import { InactivityMonitor, inactivityMs } from '../input/inactivity.js';
import { MAZE_LAYOUT, PLAYER_SPAWN, GHOST_SPAWNS } from '../maze-layout.js';
import { TILE, INACTIVITY_MS } from '../constants.js';
import { numberToCss } from '../theme-loader.js';
import { TEX } from '../textures.js';
import type { Theme } from '../../theme/theme-schema.js';
import { DEFAULT_THEME } from '../../theme/default-theme.js';

export class GameScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private state!: GameState;
  private wallsGfx!: Phaser.GameObjects.Graphics;
  private pelletsGfx!: Phaser.GameObjects.Graphics;
  private actorsGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private inactivity!: InactivityMonitor;

  // Imagens de sprite, quando o tema as fornece. `null` => desenha forma primitiva.
  private playerImg: Phaser.GameObjects.Image | null = null;
  private ghostImgs: Array<{ img: Phaser.GameObjects.Image | null; base: string }> = [];

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

    this.wallsGfx = this.add.graphics();
    this.drawWalls();
    this.pelletsGfx = this.add.graphics();
    this.actorsGfx = this.add.graphics();

    // Sprites dos personagens, quando existirem; senao ficam null (forma primitiva).
    const sprite = (key: string): Phaser.GameObjects.Image | null =>
      this.textures.exists(key)
        ? this.add.image(0, 0, key).setDisplaySize(TILE * 0.95, TILE * 0.95).setDepth(5)
        : null;
    this.playerImg = sprite(TEX.player);
    this.ghostImgs = ghosts.map((gh) => ({ img: sprite(TEX.ghost(gh.personality)), base: TEX.ghost(gh.personality) }));

    this.hud = this.add.text(8, maze.height * TILE + 12, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: this.theme.colors.text,
    });

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
      .setVisible(false);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('GameScene: teclado indisponivel.');
    this.cursors = keyboard.createCursorKeys();

    // Swipe + d-pad: principal no totem; teclado fica para o dev.
    // Auto-registra os listeners na cena — nao precisa guardar a referencia.
    new TouchControls(this, (dir) => this.state.player.queue(dir));

    // No fim de jogo, qualquer interacao leva a captura de lead.
    // Reset por inatividade cobre quem larga o totem no meio (descarta o lead).
    this.input.on('pointerdown', this.onGameOverAdvance, this);
    keyboard.on('keydown-SPACE', this.onGameOverAdvance, this);
    this.inactivity = new InactivityMonitor(this, inactivityMs(INACTIVITY_MS), () => this.scene.start('attract'));
  }

  private onGameOverAdvance(): void {
    if (this.state.phase === 'gameover') this.scene.start('lead', { score: this.state.score });
  }

  override update(_time: number, delta: number): void {
    this.readInput();
    this.inactivity.update();

    if (this.state.phase === 'playing') {
      this.state.tick(delta);
    }

    this.drawPellets();
    this.drawActors();
    this.drawHud();
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
  }

  private drawPellets(): void {
    const g = this.pelletsGfx;
    g.clear();
    for (let y = 0; y < this.state.maze.height; y++) {
      for (let x = 0; x < this.state.maze.width; x++) {
        if (this.state.pellets.hasPowerPellet(x, y)) {
          g.fillStyle(this.theme.colors.power, 1);
          g.fillCircle(this.center(x), this.center(y), TILE * 0.32);
        } else if (this.state.pellets.hasPellet(x, y)) {
          g.fillStyle(this.theme.colors.pellet, 1);
          g.fillCircle(this.center(x), this.center(y), TILE * 0.12);
        }
      }
    }
  }

  private drawActors(): void {
    const g = this.actorsGfx;
    g.clear();

    // Jogador: imagem se houver, senao circulo.
    const p = this.state.player.position;
    if (this.playerImg) {
      this.playerImg.setPosition(this.center(p.x), this.center(p.y));
    } else {
      g.fillStyle(this.theme.colors.player, 1);
      g.fillCircle(this.center(p.x), this.center(p.y), TILE * 0.42);
    }

    this.state.ghosts.forEach((ghost, i) => {
      const cx = this.center(ghost.position.x);
      const cy = this.center(ghost.position.y);
      const ref = this.ghostImgs[i];

      if (ref?.img) {
        ref.img.setPosition(cx, cy).setVisible(true).setAlpha(1).clearTint();
        if (ghost.mode === 'frightened') {
          // Sprite de frightened dedicado, ou tinge o proprio sprite de azul.
          if (this.textures.exists(TEX.frightened)) ref.img.setTexture(TEX.frightened);
          else ref.img.setTexture(ref.base).setTint(this.theme.colors.frightened);
        } else {
          ref.img.setTexture(ref.base);
          if (ghost.mode === 'eaten') ref.img.setAlpha(0.4);
        }
      } else {
        const color =
          ghost.mode === 'frightened'
            ? this.theme.colors.frightened
            : ghost.mode === 'eaten'
              ? this.theme.colors.eaten
              : this.theme.colors.ghosts[ghost.personality];
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy, TILE * 0.42);
      }
    });
  }

  private drawHud(): void {
    const fright = this.state.isFrightened ? '  [FRIGHTENED]' : '';
    this.hud.setText(`SCORE ${this.state.score}    VIDAS ${this.state.lives}${fright}`);

    if (this.state.phase === 'gameover') {
      const msg = this.state.won ? 'VOCE VENCEU!' : 'FIM DE JOGO';
      this.overlay.setText(`${msg}\n\nTOQUE PARA CONTINUAR`).setVisible(true);
    } else {
      this.overlay.setVisible(false);
    }
  }
}
