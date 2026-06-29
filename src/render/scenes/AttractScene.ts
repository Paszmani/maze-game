/**
 * AttractScene — tela de chamariz (modulo 7), totalmente dirigida pelo tema.
 *
 * Cada elemento (titulo, headline, CTA, logo, "player" animado, fundo) tem
 * cor/tamanho/posicao/visibilidade vindos de `theme.attract` e os textos de
 * `theme.branding`. Imagens (logo, fundo) entram se o tema as fornecer; senao a
 * tela funciona so com texto. Trocar de marca troca esta tela sem tocar codigo.
 */

import Phaser from 'phaser';
import type { Theme } from '../../theme/theme-schema.js';
import { DEFAULT_THEME } from '../../theme/default-theme.js';
import { numberToCss } from '../theme-loader.js';
import { TEX } from '../textures.js';

export class AttractScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;

  constructor() {
    super('attract');
  }

  init(): void {
    const theme = this.registry.get('theme') as Theme | undefined;
    if (theme) this.theme = theme;
  }

  create(): void {
    const { width, height } = this.scale;
    const { colors, branding, attract } = this.theme;

    if (this.textures.exists(TEX.attractBg)) {
      this.add.image(width / 2, height / 2, TEX.attractBg).setDisplaySize(width, height).setDepth(-1);
    }

    if (attract.logo.visible && this.textures.exists(TEX.logo)) {
      this.add.image(width / 2, height * attract.logo.y, TEX.logo).setScale(attract.logo.scale).setDepth(1);
    }

    if (attract.title.visible) {
      this.add
        .text(width / 2, height * attract.title.y, this.theme.name, {
          fontFamily: 'monospace',
          fontSize: `${attract.title.size}px`,
          color: numberToCss(attract.title.color),
        })
        .setOrigin(0.5);
    }

    if (attract.headline.visible) {
      this.add
        .text(width / 2, height * attract.headline.y, branding.attractHeadline, {
          fontFamily: 'monospace',
          fontSize: `${attract.headline.size}px`,
          color: numberToCss(attract.headline.color),
          align: 'center',
          wordWrap: { width: width * 0.85 },
        })
        .setOrigin(0.5);
    }

    if (attract.cta.visible) {
      const cta = this.add
        .text(width / 2, height * attract.cta.y, branding.ctaButton, {
          fontFamily: 'monospace',
          fontSize: `${attract.cta.size}px`,
          color: numberToCss(attract.cta.color),
          backgroundColor: numberToCss(attract.cta.background),
        })
        .setOrigin(0.5)
        .setPadding(18, 12, 18, 12);
      this.tweens.add({
        targets: cta,
        scale: 1.12,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    if (attract.showPlayer) {
      const y = height * 0.86;
      const pac = this.textures.exists(TEX.player)
        ? this.add.image(-20, y, TEX.player).setDisplaySize(28, 28)
        : this.add.circle(-20, y, 11, colors.player).setOrigin(0.5);
      this.tweens.add({ targets: pac, x: width + 20, duration: 3200, repeat: -1 });
    }

    const start = (): void => {
      this.scene.start('game');
    };
    // Zona de toque (tela toda) inicia o jogo. `topOnly` (default) garante que o
    // botao de customizar, por cima, receba o toque sem disparar o start.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive().on('pointerdown', start);
    this.input.keyboard?.once('keydown', start);

    this.buildEditorButton(width, height);
  }

  /** Botao discreto para o operador abrir a tela de customizacao (editor de tema). */
  private buildEditorButton(width: number, height: number): void {
    this.add
      .text(width - 10, height - 10, '⚙ Personalizar', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: this.theme.colors.text,
        backgroundColor: '#000000aa',
      })
      .setOrigin(1, 1)
      .setPadding(8, 6, 8, 6)
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.location.href = 'editor.html';
      });
  }
}
