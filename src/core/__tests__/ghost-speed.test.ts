import { describe, it, expect } from 'vitest';
import { effectiveGhostSpeed } from '../game-state.js';

const CFG = {
  ghostSpeed: 1,
  frightenedSpeedFactor: 0.6,
  tunnelSpeedFactor: 0.5,
  elroyDots1: 20,
  elroyDots2: 10,
  elroySpeed1: 1.05,
  elroySpeed2: 1.1,
};

const ghost = (mode: string, personality = 'blinky') =>
  ({ mode, personality }) as { mode: 'scatter' | 'chase' | 'frightened' | 'eaten'; personality: 'blinky' | 'pinky' | 'inky' | 'clyde' };

describe('effectiveGhostSpeed', () => {
  it('velocidade base normal fora do tunel', () => {
    expect(effectiveGhostSpeed(CFG, ghost('chase'), 100, false)).toBe(1);
  });

  it('frightened mais lento, olhos bem rapidos', () => {
    expect(effectiveGhostSpeed(CFG, ghost('frightened'), 100, false)).toBeCloseTo(0.6);
    expect(effectiveGhostSpeed(CFG, ghost('eaten'), 100, false)).toBe(2);
  });

  it('tunel deixa mais lento, mas nao afeta os olhos', () => {
    expect(effectiveGhostSpeed(CFG, ghost('chase'), 100, true)).toBeCloseTo(0.5);
    expect(effectiveGhostSpeed(CFG, ghost('eaten'), 100, true)).toBe(2);
  });

  it('Cruise Elroy: Blinky acelera com poucos dots', () => {
    expect(effectiveGhostSpeed(CFG, ghost('chase'), 20, false)).toBeCloseTo(1.05);
    expect(effectiveGhostSpeed(CFG, ghost('chase'), 10, false)).toBeCloseTo(1.1);
    expect(effectiveGhostSpeed(CFG, ghost('chase'), 5, false)).toBeCloseTo(1.1);
  });

  it('Elroy so vale para o Blinky', () => {
    expect(effectiveGhostSpeed(CFG, ghost('chase', 'pinky'), 5, false)).toBe(1);
  });

  it('Elroy + tunel combinam', () => {
    expect(effectiveGhostSpeed(CFG, ghost('chase'), 10, true)).toBeCloseTo(1.1 * 0.5);
  });
});
