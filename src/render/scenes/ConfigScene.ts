/**
 * ConfigScene — tela de configuracao do temporizador, entre a Attract e o Jogo.
 *
 * O visitante escolhe COMO o tempo corre na partida:
 *   - 'off'       Sem cronometro (jogo classico, sem tempo).
 *   - 'countup'   Contagem crescente ate vencer/perder (so cronometra a sessao).
 *   - 'countdown' Limite de tempo: DIGITA-SE o valor em segundos; ao zerar, acaba.
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

const MIN_SECONDS = 5;
const MAX_SECONDS = 3600;
const DEFAULT_SECONDS = 90;

export class ConfigScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private mode: TimerMode = 'countup';

  private modeButtons: Array<{ mode: TimerMode; btn: Phaser.GameObjects.Text }> = [];
  // Campo de tempo (DOM): rotulo Phaser + input HTML digitavel (dispara o teclado
  // numerico no totem/tablet). O input vive no container DOM COMPARTILHADO entre
  // cenas, entao precisa ser destruido explicitamente ao sair (senao vaza).
  private timeLabel: Phaser.GameObjects.Text | null = null;
  private timeHint: Phaser.GameObjects.Text | null = null;
  private timeInputDom: Phaser.GameObjects.DOMElement | null = null;
  private timeInput: HTMLInputElement | null = null;

  constructor() {
    super('config');
  }

  init(): void {
    const theme = this.registry.get('theme') as Theme | undefined;
    if (theme) this.theme = theme;
    // Estado zera a cada visita (a cena e reutilizada entre partidas).
    this.mode = 'countup';
    this.modeButtons = [];
    this.timeLabel = null;
    this.timeHint = null;
    this.timeInputDom = null;
    this.timeInput = null;
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

    // Campo digitavel do tempo-limite (visivel so no modo 'countdown').
    this.timeLabel = this.add
      .text(cx, height * 0.6, 'DIGITE O TEMPO LIMITE (segundos)', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: this.theme.colors.text,
      })
      .setOrigin(0.5);

    this.timeInput = this.buildTimeInput();
    this.timeInputDom = this.add.dom(cx, height * 0.68, this.timeInput);
    this.timeInput.addEventListener('input', () => this.updateHint());

    this.timeHint = this.add
      .text(cx, height * 0.74, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: this.theme.colors.text,
      })
      .setOrigin(0.5);

    // O input DOM vive num container compartilhado — remove ao sair por qualquer via.
    this.events.once('shutdown', this.destroyInput, this);
    this.events.once('destroy', this.destroyInput, this);

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

    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());

    this.refresh();
  }

  /** Input HTML numerico para digitar o tempo-limite em segundos. */
  private buildTimeInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = String(MIN_SECONDS);
    input.max = String(MAX_SECONDS);
    input.step = '5';
    input.value = String(DEFAULT_SECONDS);
    Object.assign(input.style, {
      width: '180px',
      padding: '14px',
      fontSize: '26px',
      textAlign: 'center',
      borderRadius: '10px',
      border: `2px solid ${numberToCss(this.theme.colors.maze)}`,
      background: '#ffffff',
      color: '#111111',
      fontFamily: 'monospace',
    } satisfies Partial<CSSStyleDeclaration>);
    return input;
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

  /** Segundos escolhidos, saneados para o intervalo valido (fallback ao default). */
  private chosenSeconds(): number {
    const v = this.timeInput ? Number.parseInt(this.timeInput.value, 10) : DEFAULT_SECONDS;
    if (!Number.isFinite(v)) return DEFAULT_SECONDS;
    return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, v));
  }

  /** Mostra o tempo digitado como M:SS logo abaixo do campo. */
  private updateHint(): void {
    if (!this.timeHint) return;
    const s = this.chosenSeconds();
    const mm = Math.floor(s / 60);
    const ss = (s % 60).toString().padStart(2, '0');
    this.timeHint.setText(`= ${mm}:${ss}`);
  }

  /** Aplica o realce da selecao atual e mostra/oculta o campo de tempo. */
  private refresh(): void {
    const accent = numberToCss(this.theme.colors.uiAccent);
    const bg = numberToCss(this.theme.colors.background);
    const dim = bg + 'cc';
    for (const { mode, btn } of this.modeButtons) {
      const on = mode === this.mode;
      btn.setBackgroundColor(on ? accent : dim);
      btn.setColor(on ? bg : this.theme.colors.text);
    }
    const showTime = this.mode === 'countdown';
    this.timeLabel?.setVisible(showTime);
    this.timeHint?.setVisible(showTime);
    this.timeInputDom?.setVisible(showTime);
    if (showTime) this.updateHint();
  }

  /** Remove o input DOM do container compartilhado. Idempotente. */
  private destroyInput(): void {
    this.timeInputDom?.destroy();
    this.timeInputDom = null;
    this.timeInput = null;
  }

  private startGame(): void {
    const timeLimitMs = this.mode === 'countdown' ? this.chosenSeconds() * 1000 : 0;
    this.destroyInput();
    this.scene.start('game', { timerMode: this.mode, timeLimitMs });
  }
}
