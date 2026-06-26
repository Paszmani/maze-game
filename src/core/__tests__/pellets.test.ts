import { describe, it, expect } from 'vitest';
import { Pellets } from '../pellets.js';

/**
 *   #####
 *   #o..#   power em (1,1); pellets em (2,1),(3,1)
 *   #...#   pellets em (1,2),(2,2),(3,2)
 *   #####
 */
const ASCII = ['#####', '#o..#', '#...#', '#####'];

describe('Pellets.fromAscii', () => {
  it('conta pellets e power-pellets', () => {
    const p = Pellets.fromAscii(ASCII);
    expect(p.hasPowerPellet(1, 1)).toBe(true);
    expect(p.hasPellet(2, 1)).toBe(true);
    expect(p.hasPellet(1, 1)).toBe(false); // a celula (1,1) e power, nao pellet
    expect(p.remaining()).toBe(6); // 1 power + 5 pellets
  });

  it('ignora paredes', () => {
    const p = Pellets.fromAscii(ASCII);
    expect(p.hasPellet(0, 0)).toBe(false);
  });
});

describe('Pellets.consume', () => {
  it('retorna o tipo e remove a celula', () => {
    const p = Pellets.fromAscii(ASCII);
    expect(p.consume(1, 1)).toBe('power');
    expect(p.hasPowerPellet(1, 1)).toBe(false);
    expect(p.consume(2, 1)).toBe('pellet');
    expect(p.consume(2, 1)).toBe('none'); // ja consumido
    expect(p.remaining()).toBe(4);
  });

  it('isCleared apos consumir tudo', () => {
    const p = Pellets.fromAscii(['##', '#o', '#.']);
    expect(p.isCleared()).toBe(false);
    p.consume(1, 1);
    p.consume(1, 2);
    expect(p.isCleared()).toBe(true);
  });
});

describe('Pellets.reset', () => {
  it('reabastece o estado inicial', () => {
    const p = Pellets.fromAscii(ASCII);
    p.consume(1, 1);
    p.consume(2, 1);
    expect(p.remaining()).toBe(4);
    p.reset();
    expect(p.remaining()).toBe(6);
    expect(p.hasPowerPellet(1, 1)).toBe(true);
  });
});
