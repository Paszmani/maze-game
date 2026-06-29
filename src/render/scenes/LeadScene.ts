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
import { INACTIVITY_MS } from '../constants.js';
import { createLeadStore, terminalId, type Lead } from '../../data/lead-store.js';

interface Control {
  field: LeadField;
  get: () => string;
  el: HTMLElement;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class LeadScene extends Phaser.Scene {
  private theme: Theme = DEFAULT_THEME;
  private score = 0;
  private controls: Control[] = [];
  private error!: Phaser.GameObjects.Text;
  private inactivity!: InactivityMonitor;

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

    this.add
      .text(width / 2, height * 0.1, `PONTOS: ${this.score}`, {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: numberToCss(colors.power),
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.2, branding.leadHeadline, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: colors.text,
        align: 'center',
        wordWrap: { width: width * 0.85 },
      })
      .setOrigin(0.5);

    const form = this.buildForm();
    this.add.dom(width / 2, height * 0.56, form);

    this.error = this.add
      .text(width / 2, height * 0.9, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: numberToCss(colors.uiAccent),
        align: 'center',
        wordWrap: { width: width * 0.85 },
      })
      .setOrigin(0.5);

    this.inactivity = new InactivityMonitor(this, inactivityMs(INACTIVITY_MS), () => this.scene.start('attract'));
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
      gap: '10px',
      width: '320px',
      fontFamily: 'monospace',
    } satisfies Partial<CSSStyleDeclaration>);

    for (const field of this.theme.leadForm.fields) {
      form.append(this.buildControl(field));
    }

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
      fontSize: '18px',
      borderRadius: '6px',
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
    if (field.maxLength) input.maxLength = field.maxLength;
    Object.assign(input.style, inputStyle);
    wrap.append(input);
    this.controls.push({ field, el: input, get: () => input.value.trim() });
    return wrap;
  }

  private submit(): void {
    for (const c of this.controls) {
      const value = c.get();
      if (c.field.required && value.length === 0) {
        this.error.setText(`Preencha: ${c.field.label}`);
        return;
      }
      if (c.field.type === 'email' && value.length > 0 && !EMAIL_RE.test(value)) {
        this.error.setText('E-mail inválido.');
        return;
      }
    }

    const fields: Record<string, string> = {};
    for (const c of this.controls) fields[c.field.id] = c.get();

    const lead: Lead = {
      fields,
      score: this.score,
      terminalId: (this.registry.get('terminalId') as string | undefined) ?? terminalId(),
      themeId: this.theme.id,
      timestamp: new Date().toISOString(),
    };
    createLeadStore().save(lead);

    this.confirmAndExit();
  }

  private confirmAndExit(): void {
    this.children.removeAll();
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
