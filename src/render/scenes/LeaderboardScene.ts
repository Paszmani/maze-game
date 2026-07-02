/**
 * LeaderboardScene — placar local (top pontuacoes). Alimentado pelo cadastro de
 * lead: a cada envio, nome + pontuacao entram no placar (localStorage). Aberta
 * pelo botao "Placar" da tela inicial; volta ao attract por toque/tecla ou
 * inatividade. Totalmente temada.
 */

import Phaser from 'phaser';
import type { Theme } from '../../theme/theme-schema.js';
import { DEFAULT_THEME } from '../../theme/default-theme.js';
import { numberToCss } from '../theme-loader.js';
import { InactivityMonitor, inactivityMs } from '../input/inactivity.js';
import { INACTIVITY_MS } from '../constants.js';
import { createLeaderboard, type LeaderboardEntry } from '../../data/leaderboard.js';

const TOP_N = 10;

export class LeaderboardScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private inactivity!: InactivityMonitor;

  constructor() {
    super('leaderboard');
  }

  init(): void {
    const theme = this.registry.get('theme') as Theme | undefined;
    if (theme) this.theme = theme;
  }

  create(): void {
    const { width, height } = this.scale;
    const { colors } = this.theme;

    this.add.rectangle(0, 0, width, height, colors.background, 1).setOrigin(0, 0).setDepth(-1);

    this.add
      .text(width / 2, height * 0.1, 'PLACAR', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: numberToCss(colors.power),
      })
      .setOrigin(0.5);

    const entries = createLeaderboard().top(TOP_N);
    if (entries.length === 0) {
      this.add
        .text(width / 2, height * 0.5, 'Ainda sem pontuacoes.\nJogue e cadastre-se!', {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: colors.text,
          align: 'center',
        })
        .setOrigin(0.5);
    } else {
      this.renderTable(entries, width, height);
    }

    this.buildBackButton(width, height);

    // Saida pelo botao VOLTAR (ou tecla, no dev); inatividade cobre o abandono.
    this.input.keyboard?.once('keydown', () => this.scene.start('attract'));
    this.inactivity = new InactivityMonitor(this, inactivityMs(INACTIVITY_MS), () => this.scene.start('attract'));
  }

  override update(): void {
    this.inactivity.update();
  }

  private renderTable(entries: LeaderboardEntry[], width: number, height: number): void {
    const { colors } = this.theme;
    const top = height * 0.22;
    const rowH = Math.min(42, (height * 0.62) / entries.length);
    const cx = width / 2;
    const leftX = cx - Math.min(width * 0.4, 300);
    const rightX = cx + Math.min(width * 0.4, 300);
    const fontSize = `${Math.min(24, rowH * 0.6)}px`;

    entries.forEach((e, i) => {
      const y = top + i * rowH;
      // Ouro para o 1o, cor do player para o podio, texto neutro no resto.
      const accent = i === 0 ? numberToCss(colors.power) : i < 3 ? numberToCss(colors.player) : colors.text;
      const style = { fontFamily: 'monospace', fontSize, color: accent };
      this.add.text(leftX, y, `${i + 1}.`, style).setOrigin(0, 0.5);
      this.add.text(leftX + 48, y, e.name, { fontFamily: 'monospace', fontSize, color: colors.text }).setOrigin(0, 0.5);
      this.add.text(rightX, y, String(e.score), style).setOrigin(1, 0.5);
    });
  }

  private buildBackButton(width: number, height: number): void {
    this.add
      .text(width / 2, height * 0.92, 'VOLTAR', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: numberToCss(this.theme.colors.background),
        backgroundColor: numberToCss(this.theme.colors.power),
      })
      .setOrigin(0.5)
      .setPadding(20, 10, 20, 10)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('attract'));
  }
}
