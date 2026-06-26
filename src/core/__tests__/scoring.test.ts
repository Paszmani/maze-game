import { describe, it, expect } from 'vitest';
import { Scoring, POINTS } from '../scoring.js';

describe('Scoring', () => {
  it('pontua pellets e power-pellets', () => {
    const s = new Scoring();
    expect(s.eatPellet()).toBe(POINTS.pellet);
    expect(s.eatPowerPellet()).toBe(POINTS.powerPellet);
    expect(s.score).toBe(POINTS.pellet + POINTS.powerPellet);
  });

  it('dobra o valor a cada fantasma na cadeia e satura em 1600', () => {
    const s = new Scoring();
    expect(s.eatGhost()).toBe(200);
    expect(s.eatGhost()).toBe(400);
    expect(s.eatGhost()).toBe(800);
    expect(s.eatGhost()).toBe(1600);
    expect(s.eatGhost()).toBe(1600); // satura
    expect(s.score).toBe(200 + 400 + 800 + 1600 + 1600);
    expect(s.ghostChain).toBe(5);
  });

  it('resetGhostChain volta a cadeia ao inicio', () => {
    const s = new Scoring();
    s.eatGhost();
    s.eatGhost();
    s.resetGhostChain();
    expect(s.ghostChain).toBe(0);
    expect(s.eatGhost()).toBe(200);
  });

  it('reset zera score e cadeia', () => {
    const s = new Scoring();
    s.eatPellet();
    s.eatGhost();
    s.reset();
    expect(s.score).toBe(0);
    expect(s.ghostChain).toBe(0);
  });
});
