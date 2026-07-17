import { describe, it, expect } from 'vitest';
import { leadsToCsv, CSV_BOM } from '../csv-export.js';
import type { Lead } from '../lead-store.js';

const ISO = '2026-06-26T10:00:00.000Z';

// Mesma conversao local do modulo — o teste nao pode assumir o fuso da maquina.
const pad2 = (n: number) => String(n).padStart(2, '0');
const d = new Date(ISO);
const DATA = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const HORA = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

const lead = (over: Partial<Lead> = {}): Lead => ({
  fields: {},
  score: 0,
  terminalId: 'totem-01',
  themeId: 'gsb-default',
  timestamp: ISO,
  ...over,
});

describe('leadsToCsv', () => {
  it('cabeçalho pt-BR com metadados e campos, separador ;', () => {
    const csv = leadsToCsv([lead({ fields: { name: 'Ana', email: 'a@x.com' } })]);
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('data;hora;terminal;jogo;pontuacao;name;email');
    expect(row).toBe(`${DATA};${HORA};totem-01;gsb-default;0;Ana;a@x.com`);
  });

  it('une colunas de leads com campos diferentes', () => {
    const csv = leadsToCsv([
      lead({ fields: { name: 'Ana' } }),
      lead({ fields: { name: 'Beto', phone: '99' } }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('data;hora;terminal;jogo;pontuacao;name;phone');
    // Ana nao tem phone -> celula vazia no fim
    expect(lines[1]!.endsWith(';Ana;')).toBe(true);
    expect(lines[2]!.endsWith(';Beto;99')).toBe(true);
  });

  it('ordena as linhas por timestamp (cronológico)', () => {
    const csv = leadsToCsv([
      lead({ timestamp: '2026-06-26T12:00:00.000Z', fields: { name: 'Tarde' } }),
      lead({ timestamp: '2026-06-26T08:00:00.000Z', fields: { name: 'Cedo' } }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('Cedo');
    expect(lines[2]).toContain('Tarde');
  });

  it('escapa separador, aspas e quebra de linha', () => {
    const csv = leadsToCsv([lead({ fields: { name: 'Silva; João "JS"', obs: 'linha1\nlinha2' } })]);
    const row = csv.split('\r\n')[1]!;
    expect(row).toContain('"Silva; João ""JS"""');
    expect(row).toContain('"linha1\nlinha2"');
  });

  it('lista vazia produz só o cabeçalho de metadados', () => {
    expect(leadsToCsv([])).toBe('data;hora;terminal;jogo;pontuacao');
  });

  it('BOM é o U+FEFF que o Excel espera', () => {
    expect(CSV_BOM.charCodeAt(0)).toBe(0xfeff);
  });
});
