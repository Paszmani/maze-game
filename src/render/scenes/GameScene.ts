/**
 * GameScene — a ponte entre o core e o Phaser (modulo 4).
 *
 * Responsabilidade unica: DESENHAR o estado do core e LER o input. Nenhuma regra
 * de jogo mora aqui — a cena le `state` e pinta; manda as teclas para o player e
 * chama `state.tick(delta)`. Se uma regra precisasse ser tocada aqui, a fronteira
 * core/render teria sido violada.
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
import { MAZE_LAYOUT, PLAYER_SPAWN, GHOST_SPAWNS } from '../maze-layout.js';
import { TILE, COLORS, GHOST_COLORS } from '../constants.js';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private wallsGfx!: Phaser.GameObjects.Graphics;
  private pelletsGfx!: Phaser.GameObjects.Graphics;
  private actorsGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private restartKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('game');
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

    this.state = new GameState({ maze, pellets, player, ghosts });
    this.state.start();

    this.wallsGfx = this.add.graphics();
    this.drawWalls();
    this.pelletsGfx = this.add.graphics();
    this.actorsGfx = this.add.graphics();

    this.hud = this.add.text(8, maze.height * TILE + 12, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: COLORS.text,
    });

    this.overlay = this.add
      .text(this.scale.width / 2, (maze.height * TILE) / 2, '', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: COLORS.text,
        align: 'center',
        backgroundColor: '#000010cc',
      })
      .setOrigin(0.5)
      .setPadding(16)
      .setVisible(false);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('GameScene: teclado indisponivel.');
    this.cursors = keyboard.createCursorKeys();
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Swipe + d-pad: principal no totem; teclado fica para o dev.
    // Auto-registra os listeners na cena — nao precisa guardar a referencia.
    new TouchControls(this, (dir) => this.state.player.queue(dir));
  }

  override update(_time: number, delta: number): void {
    this.readInput();

    if (this.state.phase === 'playing') {
      this.state.tick(delta);
    } else if (this.state.phase === 'gameover' && Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.state.start();
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
    g.fillStyle(COLORS.wall, 1);
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
          g.fillStyle(COLORS.power, 1);
          g.fillCircle(this.center(x), this.center(y), TILE * 0.32);
        } else if (this.state.pellets.hasPellet(x, y)) {
          g.fillStyle(COLORS.pellet, 1);
          g.fillCircle(this.center(x), this.center(y), TILE * 0.12);
        }
      }
    }
  }

  private drawActors(): void {
    const g = this.actorsGfx;
    g.clear();

    const p = this.state.player.position;
    g.fillStyle(COLORS.player, 1);
    g.fillCircle(this.center(p.x), this.center(p.y), TILE * 0.42);

    for (const ghost of this.state.ghosts) {
      const color =
        ghost.mode === 'frightened'
          ? COLORS.frightened
          : ghost.mode === 'eaten'
            ? COLORS.eaten
            : GHOST_COLORS[ghost.personality];
      g.fillStyle(color, 1);
      g.fillCircle(this.center(ghost.position.x), this.center(ghost.position.y), TILE * 0.42);
    }
  }

  private drawHud(): void {
    const fright = this.state.isFrightened ? '  [FRIGHTENED]' : '';
    this.hud.setText(`SCORE ${this.state.score}    VIDAS ${this.state.lives}${fright}`);

    if (this.state.phase === 'gameover') {
      const msg = this.state.won ? 'VOCE VENCEU!' : 'FIM DE JOGO';
      this.overlay.setText(`${msg}\n\nESPACO para reiniciar`).setVisible(true);
    } else {
      this.overlay.setVisible(false);
    }
  }
}
