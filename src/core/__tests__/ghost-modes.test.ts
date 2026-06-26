import { describe, it, expect } from 'vitest';
import { ScatterChaseSchedule, CLASSIC_LEVEL_1 } from '../ghost-modes.js';

describe('ScatterChaseSchedule (cronograma classico)', () => {
  const s = new ScatterChaseSchedule(CLASSIC_LEVEL_1);

  it('comeca em scatter', () => {
    expect(s.modeAt(0)).toBe('scatter');
    expect(s.modeAt(6_999)).toBe('scatter');
  });

  it('vira para chase no limite da primeira fase', () => {
    expect(s.modeAt(7_000)).toBe('chase');
    expect(s.modeAt(26_999)).toBe('chase');
  });

  it('alterna de volta para scatter', () => {
    expect(s.modeAt(27_000)).toBe('scatter');
    expect(s.modeAt(83_999)).toBe('scatter');
  });

  it('termina em chase permanente', () => {
    expect(s.modeAt(84_000)).toBe('chase');
    expect(s.modeAt(10_000_000)).toBe('chase');
  });

  it('rejeita cronograma vazio', () => {
    expect(() => new ScatterChaseSchedule([])).toThrow();
  });

  it('mantem o ultimo modo se nenhuma fase for infinita', () => {
    const finite = new ScatterChaseSchedule([{ mode: 'scatter', durationMs: 1_000 }]);
    expect(finite.modeAt(5_000)).toBe('scatter');
  });
});
