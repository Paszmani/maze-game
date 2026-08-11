/**
 * ConfigScene — tela de configuracao do temporizador, entre a Attract e o Jogo.
 *
 * O visitante escolhe COMO o tempo corre na partida:
 *   - 'off'       Sem cronometro (jogo classico, sem tempo).
 *   - 'countup'   Contagem crescente ate vencer/perder (so cronometra a sessao).
 *   - 'countdown' Limite de tempo: escolhe-se um valor; ao zerar, a partida acaba.
 *
 * Alvos de toque grandes e poucos passos (regra de totem). Ao confirmar, inicia a
 * GameScene passando `{ timerMode, timeLimitMs }` — a unica coisa que a cena de
 * jogo precisa saber sobre o tempo.
 */

import Phaser from 'phaser';
import type { Theme } from '../../theme/theme-schema.js';
import { DEFAULT_THEME } from '../../theme/default-theme.js';
import { numberToCss } from '../theme-loader.js';

export type TimerMode = 'off' | 'countup' | 'countdown';

const TIME_PRESETS = [30, 60, 90, 120, 180] as const;

export class ConfigScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private mode: TimerMode = 'countup';
  private seconds = 90;

  private modeButtons: Array<{ mode: TimerMode; btn: Phaser.GameObjects.Text }> = [];
  private timeButtons: Array<{ sec: number; btn: Phaser.GameObjects.Text }> = [];
  private timeRow: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('config');
  }

  init(): void {
    const theme = this.registry.get('theme') as Theme | undefined;
    if (theme) this.theme = theme;
    // Estado zera a cada visita (a cena e reutilizada entre partidas).
    this.mode = 'countup';
    this.seconds = 90;
    this.modeButtons = [];
    this.timeButtons = [];
    this.timeRow = null;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add
      .text(cx, height * 0.1, 'TEMPO DE JOGO', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: this.theme.colors.text,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, height * 0.17, 'Escolha como o tempo corre nesta partida', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: this.theme.colors.text,
        align: 'center',
        wordWrap: { width: width * 0.85 },
      })
      .setOrigin(0.5);

    // Botoes de modo, empilhados (alvos grandes para toque).
    const modes: Array<{ mode: TimerMode; label: string }> = [
      { mode: 'off', label: 'SEM CRONOMETRO' },
      { mode: 'countup', label: 'CONTAGEM CRESCENTE' },
      { mode: 'countdown', label: 'LIMITE DE TEMPO' },
    ];
    modes.forEach((m, i) => {
      const btn = this.mkButton(cx, height * (0.28 + i * 0.1), m.label, () => {
        this.mode = m.mode;
        this.refresh();
      });
      this.modeButtons.push({ mode: m.mode, btn });
    });

    // Linha de presets de tempo (visivel so no modo 'countdown').
    const label = this.add
      .text(cx, height * 0.6, 'TEMPO LIMITE (segundos)', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: this.theme.colors.text,
      })
      .setOrigin(0.5);
    const spacing = width / (TIME_PRESETS.length + 1);
    const chips: Phaser.GameObjects.Text[] = [label];
    TIME_PRESETS.forEach((sec, i) => {
      const btn = this.mkButton(spacing * (i + 1), height * 0.68, String(sec), () => {
        this.seconds = sec;
        this.refresh();
      });
      btn.setPadding(14, 10, 14, 10);
      this.timeButtons.push({ sec, btn });
      chips.push(btn);
    });
    this.timeRow = this.add.container(0, 0, chips);

    // JOGAR — confirma e inicia a partida com o timer escolhido.
    const play = this.add
      .text(cx, height * 0.85, 'JOGAR', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: numberToCss(this.theme.colors.background),
        backgroundColor: numberToCss(this.theme.colors.uiAccent),
      })
      .setOrigin(0.5)
      .setPadding(40, 16, 40, 16)
      .setInteractive({ useHandCursor: true });
    play.on('pointerdown', () => this.startGame());
    this.tweens.add({ targets: play, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Voltar para a attract.
    this.add
      .text(12, 12, '‹ VOLTAR', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: this.theme.colors.text,
        backgroundColor: '#000000aa',
      })
      .setPadding(8, 6, 8, 6)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('attract'));

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());

    this.refresh();
  }

  /** Botao base de toggle (cores atualizadas por `refresh`). */
  private mkButton(x: number, y: number, label: string, cb: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '20px', color: this.theme.colors.text })
      .setOrigin(0.5)
      .setPadding(20, 12, 20, 12)
      .setInteractive({ useHandCursor: true });
    t.on('pointerdown', cb);
    return t;
  }

  /** Aplica o realce da selecao atual e mostra/oculta a linha de tempo. */
  private refresh(): void {
    const accent = numberToCss(this.theme.colors.uiAccent);
    const bg = numberToCss(this.theme.colors.background);
    const dim = bg + 'cc';
    for (const { mode, btn } of this.modeButtons) {
      const on = mode === this.mode;
      btn.setBackgroundColor(on ? accent : dim);
      btn.setColor(on ? bg : this.theme.colors.text);
    }
    for (const { sec, btn } of this.timeButtons) {
      const on = sec === this.seconds;
      btn.setBackgroundColor(on ? accent : dim);
      btn.setColor(on ? bg : this.theme.colors.text);
    }
    this.timeRow?.setVisible(this.mode === 'countdown');
  }

  private startGame(): void {
    this.scene.start('game', {
      timerMode: this.mode,
      timeLimitMs: this.mode === 'countdown' ? this.seconds * 1000 : 0,
    });
  }
}
