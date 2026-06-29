/**
 * Bootstrap do jogo no navegador (dev). O Electron (modulo 9) so vai embrulhar
 * este mesmo build. Carrega o tema da marca ativa ANTES de montar o Phaser, e
 * injeta o Theme resolvido + a pasta-base de assets no registry global.
 *
 * Ordem das cenas: Preload (carrega imagens) -> Attract (chamariz) -> Game.
 */

import Phaser from 'phaser';
import { PreloadScene } from './render/scenes/PreloadScene.js';
import { AttractScene } from './render/scenes/AttractScene.js';
import { GameScene } from './render/scenes/GameScene.js';
import { LeadScene } from './render/scenes/LeadScene.js';
import { MAZE_LAYOUT } from './render/maze-layout.js';
import { TILE, HUD_HEIGHT } from './render/constants.js';
import { loadActiveTheme, numberToCss } from './render/theme-loader.js';

async function boot(): Promise<void> {
  const { theme, base } = await loadActiveTheme();

  const cols = MAZE_LAYOUT[0]!.length;
  const rows = MAZE_LAYOUT.length;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: cols * TILE,
    height: rows * TILE + HUD_HEIGHT,
    backgroundColor: numberToCss(theme.colors.background),
    pixelArt: true,
    // Necessario para os inputs HTML do formulario de lead (LeadScene).
    dom: { createContainer: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloadScene, AttractScene, GameScene, LeadScene],
  });

  // As cenas leem do registry global no init(). Setado antes do boot (assincrono),
  // entao ja esta disponivel. `themeBase` e a pasta dos assets do tema ativo.
  game.registry.set('theme', theme);
  game.registry.set('themeBase', base);
}

void boot();
