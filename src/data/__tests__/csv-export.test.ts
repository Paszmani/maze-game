import { describe, it, expect } from 'vitest';
import { leadsToCsv } from '../csv-export.js';
import type { Lead } from '../lead-store.js';

const lead = (over: Partial<Lead> = {}): Lead => ({
  fields: {},
  score: 0,
  terminalId: 'totem-01',
  themeId: 'gsb-default',
  timestamp: '2026-06-26T10:00:00.000Z',
  ...over,
});

describe('leadsToCsv', () => {
  it('cabeçalho com metadados e campos', () => {
    const csv = leadsToCsv([lead({ fields: { name: 'Ana', email: 'a@x.com' } })]);
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('timestamp,terminalId,themeId,score,name,email');
    expect(row).toBe('2026-06-26T10:00:00.000Z,totem-01,gsb-default,0,Ana,a@x.com');
  });

  it('une colunas de leads com campos diferentes', () => {
    const csv = leadsToCsv([
      lead({ fields: { name: 'Ana' } }),
      lead({ fields: { name: 'Beto', phone: '99' } }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('timestamp,terminalId,themeId,score,name,phone');
    // Ana nao tem phone -> celula vazia no fim
    expect(lines[1]!.endsWith(',Ana,')).toBe(true);
    expect(lines[2]!.endsWith(',Beto,99')).toBe(true);
  });

  it('escapa virgula, aspas e quebra de linha', () => {
    const csv = leadsToCsv([lead({ fields: { name: 'Silva, João "JS"', obs: 'linha1\nlinha2' } })]);
    const row = csv.split('\r\n')[1]!;
    expect(row).toContain('"Silva, João ""JS"""');
    expect(row).toContain('"linha1\nlinha2"');
  });

  it('lista vazia produz so o cabeçalho de metadados', () => {
    expect(leadsToCsv([])).toBe('timestamp,terminalId,themeId,score');
  });
});
