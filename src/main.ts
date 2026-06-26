/**
 * Bootstrap do jogo no navegador (dev). O Electron (modulo 9) so vai embrulhar
 * este mesmo build. Aqui montamos a janela Phaser e registramos as cenas.
 */

import Phaser from 'phaser';
import { GameScene } from './render/scenes/GameScene.js';
import { MAZE_LAYOUT } from './render/maze-layout.js';
import { TILE, HUD_HEIGHT } from './render/constants.js';

const cols = MAZE_LAYOUT[0]!.length;
const rows = MAZE_LAYOUT.length;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: cols * TILE,
  height: rows * TILE + HUD_HEIGHT,
  backgroundColor: '#000010',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
