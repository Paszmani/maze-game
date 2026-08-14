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
import { InactivityMonitor, inactivityMs } from '../input/inactivity.js';
import {
  MAZE_LAYOUT,
  PLAYER_SPAWN,
  GHOST_SPAWNS,
  FRUIT_POSITIONS,
  HOUSE_INTERIOR,
  HOUSE_DOOR,
  HOUSE_EXIT,
} from '../maze-layout.js';
import type { TimerMode } from './ConfigScene.js';
import { TILE, TILE_Y, INACTIVITY_MS } from '../constants.js';
import { numberToCss } from '../theme-loader.js';
import { TEX } from '../textures.js';
import { POWER_PELLET_CARD, cardOffset } from '../power-pellets.js';
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
  // Power-pellets com imagem propria (slot do tema), com sua celula.
  private powerNodes: Array<{ cell: Vec2; node: Phaser.GameObjects.Image }> = [];
  // Power-pellets sem imagem: bolinha classica (blink), como antes.
  private powerPrimitiveCells: Vec2[] = [];
  private lastRemaining = -1;
  private lastHudText = '';
  // Garante que o avanco automatico para a captura de lead arme uma unica vez.
  private leadAdvanceArmed = false;
  // Pausa: congela o tick e mostra o menu (retomar / menu inicial).
  private paused = false;
  private pauseUi: Phaser.GameObjects.Container | null = null;

  // Imagens de sprite, quando o tema as fornece. `null` => desenha forma primitiva.
  private playerImg: Phaser.GameObjects.Image | null = null;
  private ghostImgs: Array<{ img: Phaser.GameObjects.Image | null; base: string }> = [];
  // Texto opcional embaixo de cada fantasma (um por fantasma; vazio se desativado).
  private ghostLabels: Phaser.GameObjects.Text[] = [];
  // Uma imagem de fruta por posicao possivel (quando o tema fornece sprite).
  private fruitPositions: Vec2[] = FRUIT_POSITIONS.map((c) => ({ ...c }));
  private fruitImgs: Phaser.GameObjects.Image[] = [];
  private now = 0;

  // Temporizador escolhido na tela de configuracao (ConfigScene).
  private timerMode: TimerMode = 'off';
  private timeLimitMs = 0;

  constructor() {
    super('game');
  }

  init(data?: { timerMode?: TimerMode; timeLimitMs?: number }): void {
    const theme = this.registry.get('theme') as Theme | undefined;
    if (theme) this.theme = theme;
    this.timerMode = data?.timerMode ?? 'off';
    this.timeLimitMs = data?.timeLimitMs ?? 0;
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
        // Fruta: 5 posicoes, reaparecendo com frequencia (varias podem coexistir).
        fruitPositions: this.fruitPositions.map((c) => ({ ...c })),
        fruitSpawnIntervalMs: 4_000,
        fruitMaxActive: this.fruitPositions.length,
        // Tema: fruta pode ativar o frightened como um power-pellet.
        fruitAsPower: this.theme.gameplay.fruitAsPower,
        // Temporizador escolhido na ConfigScene.
        timerMode: this.timerMode,
        timeLimitMs: this.timeLimitMs,
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
        .image((maze.width * TILE) / 2, (maze.height * TILE_Y) / 2, TEX.mazeBg)
        .setDisplaySize(maze.width * TILE, maze.height * TILE_Y)
        .setDepth(-1);
    }

    // Reset por (re)create — campos de classe persistem entre restarts da cena.
    this.pelletCells = [];
    this.powerCells = [];
    this.pelletImgs = [];
    this.powerImgs = [];
    this.powerNodes = [];
    this.powerPrimitiveCells = [];
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
        this.add.image(this.cx(c.x), this.cy(c.y), TEX.pellet).setDisplaySize(TILE * 0.5, TILE * 0.5).setDepth(1),
      );
    }
    // Power-pellets: cada celula pode ter card/imagem propria (customizacao
    // individual). As sem estilo caem na bolinha primitiva (themed sprite ou circulo).
    this.buildPowerPellets(maze.width, maze.height);

    this.actorsGfx = this.add.graphics().setDepth(2);

    // Sprites dos personagens, quando existirem; senao ficam null (forma primitiva).
    const sprite = (key: string): Phaser.GameObjects.Image | null =>
      this.textures.exists(key)
        ? this.add.image(0, 0, key).setDisplaySize(TILE * 0.95, TILE * 0.95).setDepth(5)
        : null;
    this.playerImg = sprite(TEX.player);
    // Player um pouco maior que os fantasmas (o sprite base usa TILE*0.95).
    this.playerImg?.setDisplaySize(TILE * 1.1, TILE * 1.1);
    this.ghostImgs = ghosts.map((gh) => ({ img: sprite(TEX.ghost(gh.personality)), base: TEX.ghost(gh.personality) }));

    // Texto opcional embaixo dos fantasmas (habilitado no editor de tema). Um Text
    // por fantasma, reposicionado a cada frame em drawActors. Vazio => sem texto.
    this.ghostLabels = [];
    const gl = this.theme.ghostLabel;
    if (gl.enabled) {
      this.ghostLabels = ghosts.map((_, i) =>
        this.add
          .text(0, 0, (gl.texts[i] ?? '').trim(), {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: numberToCss(gl.color),
            align: 'center',
          })
          .setOrigin(0.5, 0)
          .setDepth(6)
          .setVisible(false),
      );
    }
    // Uma imagem de fruta por posicao possivel (ocultas ate a fruta acender ali).
    this.fruitImgs = [];
    if (this.textures.exists(TEX.fruit)) {
      this.fruitImgs = this.fruitPositions.map((c) => {
        const img = this.add.image(this.cx(c.x), this.cy(c.y), TEX.fruit).setDepth(5).setVisible(false);
        // Responsivo: cabe em ~1.2 tile preservando a proporcao (nao distorce).
        this.fitDisplaySize(img, TILE * 1.2, TILE_Y * 1.2);
        return img;
      });
    }

    this.hud = this.add.text(8, maze.height * TILE_Y + 12, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: this.theme.colors.text,
    }).setDepth(10);

    this.overlay = this.add
      .text(this.scale.width / 2, (maze.height * TILE_Y) / 2, '', {
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

    // Controle por SWIPE em qualquer plataforma (arrastar o dedo vira o player).
    // O d-pad on-screen (setas) foi removido — no Android poluia a tela.
    // Auto-registra os listeners na cena — nao precisa guardar a referencia.
    new TouchControls(this, (dir) => this.state.player.queue(dir), { showDpad: false });

    // Reset por inatividade cobre quem larga o totem ANTES de terminar a partida.
    this.inactivity = new InactivityMonitor(this, inactivityMs(INACTIVITY_MS), () => this.scene.start('attract'));
    this.leadAdvanceArmed = false;

    // A cena e reutilizada entre partidas — estado de pausa zera aqui.
    this.paused = false;
    this.pauseUi = null;
    this.buildPauseButton();
    keyboard.on('keydown-ESC', () => this.togglePause());
  }

  override update(time: number, delta: number): void {
    this.now = time;
    if (this.paused) {
      // Totem largado em pausa: a inatividade ainda recicla para o attract.
      this.inactivity.update();
      return;
    }
    this.readInput();

    if (this.state.phase === 'playing') {
      this.inactivity.update();
      this.state.tick(delta);
    } else if (this.state.phase === 'gameover' && !this.leadAdvanceArmed) {
      // Fim de jogo (vitoria OU derrota): mostra o resultado um instante e segue.
      // Lead habilitado no tema -> formulario (opcional, da pra pular); senao attract.
      this.leadAdvanceArmed = true;
      this.time.delayedCall(1600, () => {
        if (this.theme.leadForm.enabled) this.scene.start('lead', { score: this.state.score });
        else this.scene.start('attract');
      });
    }

    this.drawPellets();
    this.drawPowerPellets();
    this.drawActors();
    this.drawFruits();
    this.drawHud();
    this.spawnPopups();
  }

  // --- Pausa --------------------------------------------------------------

  private buildPauseButton(): void {
    const btn = this.add
      .text(this.scale.width - 6, 4, '⏸', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: this.theme.colors.text,
        backgroundColor: numberToCss(this.theme.colors.background) + '99',
      })
      .setOrigin(1, 0)
      .setPadding(8, 4, 8, 4)
      .setDepth(15)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.togglePause());
  }

  private togglePause(): void {
    if (this.state.phase !== 'playing') return;
    if (this.paused) this.resumeGame();
    else this.pauseGame();
  }

  private pauseGame(): void {
    this.paused = true;
    this.tweens.pauseAll();
    const w = this.scale.width;
    const h = this.scale.height;
    const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.75).setOrigin(0).setInteractive();
    const title = this.add
      .text(w / 2, h * 0.3, 'PAUSADO', { fontFamily: 'monospace', fontSize: '40px', color: this.theme.colors.text })
      .setOrigin(0.5);
    const mkBtn = (y: number, label: string, primary: boolean, cb: () => void): Phaser.GameObjects.Text => {
      const t = this.add
        .text(w / 2, y, label, {
          fontFamily: 'monospace',
          fontSize: '24px',
          color: primary ? numberToCss(this.theme.colors.background) : this.theme.colors.text,
          backgroundColor: primary
            ? numberToCss(this.theme.colors.uiAccent)
            : numberToCss(this.theme.colors.background) + 'cc',
        })
        .setOrigin(0.5)
        .setPadding(22, 12, 22, 12)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', cb);
      return t;
    };
    const resume = mkBtn(h * 0.46, 'RETOMAR', true, () => this.resumeGame());
    const menu = mkBtn(h * 0.58, 'MENU INICIAL', false, () => this.scene.start('attract'));
    this.pauseUi = this.add.container(0, 0, [bg, title, resume, menu]).setDepth(40);
  }

  private resumeGame(): void {
    this.paused = false;
    this.tweens.resumeAll();
    this.pauseUi?.destroy(true);
    this.pauseUi = null;
  }

  // --- Fruta e popups ----------------------------------------------------

  private drawFruits(): void {
    const active = new Set(this.state.fruits.map((f) => `${f.position.x},${f.position.y}`));
    if (this.fruitImgs.length > 0) {
      this.fruitPositions.forEach((p, i) => this.fruitImgs[i]!.setVisible(active.has(`${p.x},${p.y}`)));
      return;
    }
    // Sem sprite: desenha cada fruta ativa (no actorsGfx, ja limpo neste frame).
    for (const f of this.state.fruits) {
      const px = this.cx(f.position.x);
      const py = this.cy(f.position.y);
      this.actorsGfx.fillStyle(this.theme.colors.power, 1);
      this.actorsGfx.fillCircle(px, py, TILE * 0.3);
      this.actorsGfx.lineStyle(2, this.theme.colors.uiAccent, 1);
      this.actorsGfx.strokeCircle(px, py, TILE * 0.3);
    }
  }

  /** Texto "+N" subindo e sumindo ao comer fruta/fantasma. */
  private spawnPopups(): void {
    for (const popup of this.state.drainPopups()) {
      const text = this.add
        .text(this.cx(popup.position.x), this.cy(popup.position.y), `+${popup.value}`, {
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

  /** Centro X (pixels) da coluna `cell`. */
  private cx(cell: number): number {
    return cell * TILE + TILE / 2;
  }

  /** Centro Y (pixels) da linha `cell`. Usa TILE_Y (celula achatada). */
  private cy(cell: number): number {
    return cell * TILE_Y + TILE_Y / 2;
  }

  /**
   * Paredes no estilo classico de arcade: traco fino arredondado em vez de blocos
   * solidos. Para cada celula de parede, desenha so as arestas que dao para um
   * corredor (vizinho nao-parede), recuadas `m` px para dentro da parede, com
   * quartos de circulo nos cantos convexos. Paredes de 1 tile viram "linha dupla";
   * blocos grossos viram contorno. Roda uma vez (camada estatica).
   */
  private drawWalls(): void {
    const g = this.wallsGfx;
    const maze = this.state.maze;
    const m = TILE * 0.22;
    const r = m;
    const lw = Math.max(2, TILE * 0.11);
    const isW = (x: number, y: number): boolean => maze.isWall(x, y);
    g.lineStyle(lw, this.theme.colors.maze, 1);

    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        if (!isW(x, y)) continue;
        const px = x * TILE;
        const py = y * TILE_Y;
        const left = px + m;
        const right = px + TILE - m;
        const top = py + m;
        const bottom = py + TILE_Y - m;
        const N = !isW(x, y - 1);
        const S = !isW(x, y + 1);
        const Wl = !isW(x - 1, y);
        const E = !isW(x + 1, y);

        // Arestas retas (recuadas; recuam mais nos cantos convexos para o arco caber).
        g.beginPath();
        if (N) {
          g.moveTo(Wl ? left + r : px, top);
          g.lineTo(E ? right - r : px + TILE, top);
        }
        if (S) {
          g.moveTo(Wl ? left + r : px, bottom);
          g.lineTo(E ? right - r : px + TILE, bottom);
        }
        if (Wl) {
          g.moveTo(left, N ? top + r : py);
          g.lineTo(left, S ? bottom - r : py + TILE_Y);
        }
        if (E) {
          g.moveTo(right, N ? top + r : py);
          g.lineTo(right, S ? bottom - r : py + TILE_Y);
        }
        g.strokePath();

        // Cantos convexos: quarto de circulo ligando as duas arestas.
        if (N && Wl) this.cornerArc(left + r, top + r, r, Math.PI, Math.PI * 1.5);
        if (N && E) this.cornerArc(right - r, top + r, r, Math.PI * 1.5, Math.PI * 2);
        if (S && Wl) this.cornerArc(left + r, bottom - r, r, Math.PI * 0.5, Math.PI);
        if (S && E) this.cornerArc(right - r, bottom - r, r, 0, Math.PI * 0.5);
      }
    }
    this.drawHouseDoor();
  }

  /** Barra da porta da casa dos fantasmas — leitura visual da "caixa fisica". */
  private drawHouseDoor(): void {
    const g = this.wallsGfx;
    const { x, y } = HOUSE_DOOR;
    const w = TILE * 0.8;
    const h = Math.max(3, TILE_Y * 0.16);
    g.fillStyle(this.theme.colors.frightened, 1);
    g.fillRect(x * TILE + (TILE - w) / 2, y * TILE_Y + TILE_Y - h, w, h);
  }

  /** Quarto de circulo (canto arredondado de parede), em seu proprio subpath. */
  private cornerArc(cx: number, cy: number, radius: number, start: number, end: number): void {
    const g = this.wallsGfx;
    g.beginPath();
    g.arc(cx, cy, radius, start, end, false);
    g.strokePath();
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
      if (this.state.pellets.hasPellet(c.x, c.y)) g.fillCircle(this.cx(c.x), this.cy(c.y), TILE * 0.12);
    }
  }

  /**
   * Cria os objetos de cada power-pellet uma vez. Slot `i` (ordem dos cantos) com
   * imagem propria (tema) vira uma IMAGEM grande e responsiva; sem imagem, cai na
   * bolinha classica (sprite unico do tema se houver, senao circulo desenhado).
   */
  private buildPowerPellets(cols: number, rows: number): void {
    this.powerCells.forEach((cell, i) => {
      const key = TEX.powerSlot(i);
      if (this.textures.exists(key)) {
        const off = cardOffset(cell.x, cell.y, cols, rows);
        const ox = this.cx(cell.x) + off.x * TILE;
        const oy = this.cy(cell.y) + off.y * TILE_Y;
        // Depth 3: acima de paredes/pellets, abaixo dos atores (o jogador passa por cima).
        const node = this.add.image(ox, oy, key).setDepth(3);
        this.fitDisplaySize(node, POWER_PELLET_CARD.widthTiles * TILE, POWER_PELLET_CARD.heightTiles * TILE_Y);
        this.powerNodes.push({ cell, node });
      } else if (this.textures.exists(TEX.power)) {
        this.powerImgs.push(
          this.add.image(this.cx(cell.x), this.cy(cell.y), TEX.power).setDisplaySize(TILE * 0.9, TILE * 0.9).setDepth(1),
        );
        this.powerPrimitiveCells.push(cell);
      } else {
        this.powerPrimitiveCells.push(cell);
      }
    });
  }

  /**
   * Ajusta o tamanho de exibicao de uma imagem para caber em (maxW x maxH)
   * PRESERVANDO a proporcao original — responsivo, sem distorcer o sprite.
   */
  private fitDisplaySize(img: Phaser.GameObjects.Image, maxW: number, maxH: number): void {
    const src = img.texture.getSourceImage() as { width: number; height: number };
    const iw = src.width || 1;
    const ih = src.height || 1;
    const scale = Math.min(maxW / iw, maxH / ih);
    img.setDisplaySize(iw * scale, ih * scale);
  }

  /** Power-pellets: imagens customizadas (tamanho fixo, sem distorcer) + bolinhas classicas (piscam). */
  private drawPowerPellets(): void {
    for (const { cell, node } of this.powerNodes) {
      node.setVisible(this.state.pellets.hasPowerPellet(cell.x, cell.y));
    }

    if (this.powerPrimitiveCells.length === 0) return;
    const show = this.now % 400 < 280; // fase acesa do pisca
    if (this.powerImgs.length > 0) {
      this.powerPrimitiveCells.forEach((c, i) =>
        this.powerImgs[i]!.setVisible(show && this.state.pellets.hasPowerPellet(c.x, c.y)),
      );
      return;
    }
    const g = this.pelletsGfx;
    g.clear();
    if (!show) return;
    g.fillStyle(this.theme.colors.power, 1);
    for (const c of this.powerPrimitiveCells) {
      if (this.state.pellets.hasPowerPellet(c.x, c.y)) g.fillCircle(this.cx(c.x), this.cy(c.y), TILE * 0.32);
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
    const fx = this.cx(from.x);
    const fy = this.cy(from.y);
    const tx = this.cx(to.x);
    const ty = this.cy(to.y);
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
        pos = { x: this.cx(ghost.position.x), y: this.cy(ghost.position.y) + Math.sin(this.now * 0.005) * 3 };
      }
      // Texto opcional embaixo do fantasma, acompanhando a posicao. So aparece
      // quando aquele fantasma tem texto proprio (celula vazia => sem rotulo).
      const label = this.ghostLabels[i];
      if (label && label.text) label.setPosition(pos.x, pos.y + TILE_Y * 0.5).setVisible(true);
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
    const r = TILE * 0.5;
    const open = (Math.sin(this.now * 0.012) + 1) / 2; // 0..1
    const mouth = Phaser.Math.DegToRad(6 + open * 34);
    const a = Phaser.Math.DegToRad(this.dirAngle(dir));
    g.fillStyle(this.theme.colors.player, 1);
    g.slice(x, y, r, a + mouth, a + Math.PI * 2 - mouth, false);
    g.fillPath();
  }

  /** Formata milissegundos como M:SS para o HUD. */
  private fmtTime(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private drawHud(): void {
    const fright = this.state.isFrightened ? '  [FRIGHTENED]' : '';
    let timer = '';
    if (this.state.timerMode === 'countdown') timer = `    TEMPO ${this.fmtTime(this.state.timeRemainingMs)}`;
    else if (this.state.timerMode === 'countup') timer = `    TEMPO ${this.fmtTime(this.state.elapsedMs)}`;
    const text = `SCORE ${this.state.score}    VIDAS ${this.state.lives}${timer}${fright}`;
    if (text !== this.lastHudText) {
      this.lastHudText = text;
      this.hud.setText(text);
    }

    if (this.state.phase === 'gameover') {
      const msg = this.state.isTimeUp ? 'TEMPO ESGOTADO' : this.state.won ? 'VOCE VENCEU!' : 'FIM DE JOGO';
      this.overlay.setText(msg).setVisible(true);
    } else if (this.state.isReady) {
      this.overlay.setText('PRONTO!').setVisible(true);
    } else {
      this.overlay.setVisible(false);
    }
  }
}
