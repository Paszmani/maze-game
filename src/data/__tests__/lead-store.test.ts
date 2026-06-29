import { describe, it, expect } from 'vitest';
import { WebLeadStore, type Lead } from '../lead-store.js';

/** Backend Storage falso em memoria, para testar sem browser. */
function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const lead = (over: Partial<Lead> = {}): Lead => ({
  fields: { name: 'Ana' },
  score: 100,
  terminalId: 'totem-01',
  themeId: 'gsb-default',
  timestamp: '2026-06-26T10:00:00.000Z',
  ...over,
});

describe('WebLeadStore', () => {
  it('salva e lista na ordem de gravacao', () => {
    const store = new WebLeadStore(fakeStorage());
    store.save(lead({ fields: { name: 'Ana' } }));
    store.save(lead({ fields: { name: 'Beto' } }));
    const all = store.all();
    expect(all).toHaveLength(2);
    expect(all[0]!.fields.name).toBe('Ana');
    expect(all[1]!.fields.name).toBe('Beto');
  });

  it('all() em store vazio retorna lista vazia', () => {
    expect(new WebLeadStore(fakeStorage()).all()).toEqual([]);
  });

  it('clear esvazia', () => {
    const store = new WebLeadStore(fakeStorage());
    store.save(lead());
    store.clear();
    expect(store.all()).toEqual([]);
  });

  it('dado corrompido nao quebra (retorna vazio)', () => {
    const backend = fakeStorage();
    backend.setItem('kioskMazeLeads', '{nao é json}');
    expect(new WebLeadStore(backend).all()).toEqual([]);
  });
});
