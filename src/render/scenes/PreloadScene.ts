/**
 * PreloadScene — carrega os assets de imagem do tema antes de tudo (modulo 7+).
 *
 * Le os caminhos do `Theme` e enfileira no loader do Phaser. Cada sprite e
 * opcional: se o caminho for null ou a imagem falhar (404), a textura
 * simplesmente nao existe e as cenas caem na forma primitiva. E assim que o
 * "trocar sprite por imagem" funciona sem tocar codigo — o designer solta o PNG
 * na pasta do tema e referencia no theme.json.
 */

import Phaser from 'phaser';
import type { Theme } from '../../theme/theme-schema.js';
import { DEFAULT_THEME } from '../../theme/default-theme.js';
import { assetUrl } from '../theme-loader.js';
import { TEX, GHOSTS } from '../textures.js';

export class PreloadScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private base = '';

  constructor() {
    super('preload');
  }

  init(): void {
    this.theme = (this.registry.get('theme') as Theme | undefined) ?? DEFAULT_THEME;
    this.base = (this.registry.get('themeBase') as string | undefined) ?? '';
  }

  preload(): void {
    // Falha de imagem nao quebra: textures.exists() cobre o fallback nas cenas.
    this.load.on('loaderror', () => {});

    const s = this.theme.sprites;
    const q = (key: string, path: string | null): void => {
      if (path) this.load.image(key, assetUrl(this.base, path));
    };

    q(TEX.player, s.player);
    q(TEX.pellet, s.pellet);
    q(TEX.power, s.powerPellet);
    q(TEX.frightened, s.frightened);
    q(TEX.mazeBg, s.mazeBackground);
    q(TEX.attractBg, s.attractBackground);
    q(TEX.logo, this.theme.branding.logo);
    for (const p of GHOSTS) q(TEX.ghost(p), s.ghosts[p]);
  }

  create(): void {
    // `?screen=lead|game` pula direto para uma cena (dev/teste); default attract.
    const screen = new URLSearchParams(window.location.search).get('screen');
    if (screen === 'lead') this.scene.start('lead', { score: 1234 });
    else if (screen === 'game') this.scene.start('game');
    else this.scene.start('attract');
  }
}
