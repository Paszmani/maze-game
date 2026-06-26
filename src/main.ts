/**
 * Bootstrap do jogo no navegador (dev). O Electron (modulo 9) so vai embrulhar
 * este mesmo build. Carrega o tema da marca ativa ANTES de montar o Phaser, e
 * injeta o Theme resolvido na GameScene via dados de cena.
 */

import Phaser from 'phaser';
import { GameScene } from './render/scenes/GameScene.js';
import { MAZE_LAYOUT } from './render/maze-layout.js';
import { TILE, HUD_HEIGHT } from './render/constants.js';
import { loadTheme, numberToCss } from './render/theme-loader.js';

async function boot(): Promise<void> {
  const theme = await loadTheme();

  const cols = MAZE_LAYOUT[0]!.length;
  const rows = MAZE_LAYOUT.length;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: cols * TILE,
    height: rows * TILE + HUD_HEIGHT,
    backgroundColor: numberToCss(theme.colors.background),
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene],
  });

  // A cena le o tema do registry global no init(). Setado antes do boot da cena
  // (que e assincrono), entao ja esta disponivel quando create() roda.
  game.registry.set('theme', theme);
}

void boot();
