/**
 * LeadScene — pontuacao final + captura de lead (modulo 8). O produto do totem.
 *
 * O formulario e GERADO a partir de `theme.leadForm.fields`: cada campo vira um
 * input HTML (via DOM do Phaser) conforme seu tipo, com validacao leve. No envio,
 * monta um `Lead` (respostas + metadados) e grava no LeadStore. A pontuacao e so
 * a isca exibida no topo — capturamos o lead mesmo se a pessoa perdeu logo.
 *
 * Inputs nativos disparam o teclado on-screen do proprio dispositivo (tablet/totem).
 */

import Phaser from 'phaser';
import type { Theme } from '../../theme/theme-schema.js';
import type { LeadField } from '../../theme/theme-schema.js';
import { DEFAULT_THEME } from '../../theme/default-theme.js';
import { numberToCss } from '../theme-loader.js';
import { InactivityMonitor, inactivityMs } from '../input/inactivity.js';
import { createLeadStore, terminalId, type Lead } from '../../data/lead-store.js';
import { createLeaderboard } from '../../data/leaderboard.js';

interface Control {
  field: LeadField;
  get: () => string;
  el: HTMLElement;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A captura de lead so sai ao ENVIAR. Mantemos uma rede de seguranca de
 * inatividade mais longa (totem nao pode ficar preso se a pessoa abandonar),
 * mas QUALQUER interacao com o formulario zera o cronometro — quem esta
 * preenchendo nunca e expulso. Tunavel por `?idle=<ms>`.
 */
const LEAD_IDLE_MS = 60_000;

export class LeadScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private score = 0;
  private controls: Control[] = [];
  private error!: Phaser.GameObjects.Text;
  private inactivity!: InactivityMonitor;
  // Referencia ao form (DOM): elementos DOM do Phaser vivem num container
  // COMPARTILHADO entre cenas, entao precisam ser destruidos explicitamente —
  // senao o <form> "vaza" e fica sobreposto ao jogo na partida seguinte.
  private formDom?: Phaser.GameObjects.DOMElement;

  constructor() {
    super('lead');
  }

  init(data: { score?: number }): void {
    const theme = this.registry.get('theme') as Theme | undefined;
    if (theme) this.theme = theme;
    this.score = data.score ?? 0;
    this.controls = [];
  }

  create(): void {
    const { width, height } = this.scale;
    const { colors, branding } = this.theme;

    // Fundo solido cobrindo a tela: a captura de lead e uma tela fixa propria,
    // nao um overlay sobre o jogo.
    this.add.rectangle(0, 0, width, height, colors.background, 1).setOrigin(0, 0).setDepth(-1);

    this.add
      .text(width / 2, height * 0.08, this.score > 0 ? `PONTOS: ${this.score}` : 'FIM DE JOGO', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: numberToCss(colors.power),
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.17, branding.leadHeadline, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: colors.text,
        align: 'center',
        wordWrap: { width: width * 0.85 },
      })
      .setOrigin(0.5);

    const form = this.buildForm();
    this.formDom = this.add.dom(width / 2, height * 0.55, form);

    // Garante a remocao do <form> ao sair da cena por QUALQUER caminho
    // (envio, inatividade, recriacao) — evita o overlay fantasma sobre o jogo.
    this.events.once('shutdown', this.destroyForm, this);
    this.events.once('destroy', this.destroyForm, this);

    this.error = this.add
      .text(width / 2, height * 0.92, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: numberToCss(colors.uiAccent),
        align: 'center',
        wordWrap: { width: width * 0.85 },
      })
      .setOrigin(0.5);

    // Rede de seguranca contra abandono — zerada a cada interacao com o form,
    // de modo que so dispara se a pessoa realmente largar o totem.
    this.inactivity = new InactivityMonitor(this, inactivityMs(LEAD_IDLE_MS), () => this.scene.start('attract'));
    for (const ev of ['input', 'change', 'pointerdown', 'keydown']) {
      form.addEventListener(ev, () => this.inactivity.reset());
    }
  }

  override update(): void {
    this.inactivity.update();
  }

  // --- Formulario --------------------------------------------------------

  private buildForm(): HTMLFormElement {
    const { colors } = this.theme;
    const form = document.createElement('form');
    Object.assign(form.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      // Card fluido: confortavel no mobile e no totem.
      width: 'clamp(260px, 86vw, 420px)',
      boxSizing: 'border-box',
      padding: '22px',
      borderRadius: '16px',
      background: 'rgba(0, 0, 0, 0.35)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
      fontFamily: 'monospace',
    } satisfies Partial<CSSStyleDeclaration>);

    for (const field of this.theme.leadForm.fields) {
      form.append(this.buildControl(field));
    }

    const note = document.createElement('p');
    note.textContent = 'Preencha os dados para concorrer — ou pule se preferir.';
    Object.assign(note.style, {
      margin: '2px 0 0',
      fontSize: '13px',
      lineHeight: '1.4',
      color: this.theme.colors.text,
      opacity: '0.7',
      textAlign: 'center',
    } satisfies Partial<CSSStyleDeclaration>);
    form.append(note);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'ENVIAR';
    Object.assign(submit.style, {
      marginTop: '6px',
      padding: '14px',
      fontSize: '20px',
      fontWeight: '700',
      border: 'none',
      borderRadius: '8px',
      background: numberToCss(colors.power),
      color: numberToCss(colors.background),
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>);
    form.append(submit);

    // Lead e OPCIONAL (padrao dos outros jogos): da para pular sem preencher.
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = 'Agora não';
    Object.assign(skip.style, {
      padding: '10px',
      fontSize: '15px',
      border: 'none',
      borderRadius: '8px',
      background: 'transparent',
      color: this.theme.colors.text,
      opacity: '0.75',
      cursor: 'pointer',
      textDecoration: 'underline',
    } satisfies Partial<CSSStyleDeclaration>);
    skip.addEventListener('click', () => {
      this.destroyForm();
      this.scene.start('attract');
    });
    form.append(skip);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    return form;
  }

  private buildControl(field: LeadField): HTMLElement {
    const { colors } = this.theme;
    const wrap = document.createElement('label');
    Object.assign(wrap.style, { display: 'flex', flexDirection: 'column', gap: '4px', color: numberToCss(colors.player), fontSize: '15px' });
    wrap.append(document.createTextNode(field.label + (field.required ? ' *' : '')));

    const inputStyle: Partial<CSSStyleDeclaration> = {
      padding: '12px',
      minHeight: '48px', // alvo de toque confortavel
      boxSizing: 'border-box',
      width: '100%',
      fontSize: '16px', // >=16px evita zoom automatico no iOS
      borderRadius: '8px',
      border: `2px solid ${numberToCss(colors.maze)}`,
      background: '#ffffff',
      color: '#111111',
    };

    if (field.type === 'select') {
      const sel = document.createElement('select');
      Object.assign(sel.style, inputStyle);
      sel.append(new Option('—', ''));
      for (const opt of field.options ?? []) sel.append(new Option(opt, opt));
      wrap.append(sel);
      this.controls.push({ field, el: sel, get: () => sel.value });
      return wrap;
    }

    if (field.type === 'checkbox') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      Object.assign(cb.style, { width: '28px', height: '28px' });
      // checkbox fica em linha com o texto
      Object.assign(wrap.style, { flexDirection: 'row', alignItems: 'center', gap: '10px' });
      wrap.prepend(cb);
      this.controls.push({ field, el: cb, get: () => (cb.checked ? 'sim' : '') });
      return wrap;
    }

    const input = document.createElement('input');
    input.type = field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text';
    // Teclado on-screen apropriado no mobile.
    if (field.type === 'email') {
      input.inputMode = 'email';
      input.autocomplete = 'email';
    } else if (field.type === 'tel') {
      input.inputMode = 'tel';
      input.autocomplete = 'tel';
    } else {
      input.autocomplete = 'on';
    }
    if (field.maxLength) input.maxLength = field.maxLength;
    Object.assign(input.style, inputStyle);
    wrap.append(input);
    this.controls.push({ field, el: input, get: () => input.value.trim() });
    return wrap;
  }

  private flagInvalid(c: Control, message: string): void {
    this.error.setText(message);
    c.el.style.borderColor = numberToCss(this.theme.colors.uiAccent);
    if (c.el instanceof HTMLInputElement || c.el instanceof HTMLSelectElement) c.el.focus();
  }

  private submit(): void {
    // Limpa marcas de erro anteriores.
    for (const c of this.controls) c.el.style.borderColor = numberToCss(this.theme.colors.maze);
    this.error.setText('');

    for (const c of this.controls) {
      const value = c.get();
      if (c.field.required && value.length === 0) {
        this.flagInvalid(c, `Preencha: ${c.field.label}`);
        return;
      }
      if (c.field.type === 'email' && value.length > 0 && !EMAIL_RE.test(value)) {
        this.flagInvalid(c, 'E-mail inválido.');
        return;
      }
    }

    const fields: Record<string, string> = {};
    for (const c of this.controls) fields[c.field.id] = c.get();

    const timestamp = new Date().toISOString();
    const lead: Lead = {
      fields,
      score: this.score,
      terminalId: (this.registry.get('terminalId') as string | undefined) ?? terminalId(),
      themeId: this.theme.id,
      timestamp,
    };
    createLeadStore().save(lead);

    // Placar local: usa o campo de nome (id 'name'); cai no primeiro preenchido.
    const name = fields['name'] ?? Object.values(fields).find((v) => v.trim().length > 0) ?? '';
    createLeaderboard().add(name, this.score, timestamp);

    this.confirmAndExit();
  }

  /** Remove o <form> do DOM. Idempotente — seguro chamar mais de uma vez. */
  private destroyForm(): void {
    this.formDom?.destroy();
    this.formDom = undefined;
  }

  private confirmAndExit(): void {
    this.destroyForm(); // tira o formulario da tela antes do agradecimento
    this.children.removeAll(true); // `true` DESTROI os objetos (nao so remove da lista)
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'OBRIGADO!', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: this.theme.colors.text,
      })
      .setOrigin(0.5);
    this.time.delayedCall(1800, () => this.scene.start('attract'));
  }
}
