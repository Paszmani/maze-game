import { describe, it, expect } from 'vitest';
import { POWER } from '../maze-layout.js';
import { POWER_PELLET_CARD, cardOffset } from '../power-pellets.js';

/**
 * A geometria dos power-pellets customizados: o card-alvo e maior que um tile e o
 * deslocamento sempre aponta para DENTRO do labirinto (senao o card cresceria por
 * cima da borda externa e sairia da tela).
 */
describe('power-pellets — geometria do card', () => {
  it('a caixa-alvo do card e maior que um tile', () => {
    expect(POWER_PELLET_CARD.widthTiles).toBeGreaterThan(1);
    expect(POWER_PELLET_CARD.heightTiles).toBeGreaterThan(1);
  });

  it('o deslocamento aponta para dentro a partir de cada canto', () => {
    const cols = 28;
    const rows = 31;
    const tl = cardOffset(1, 3, cols, rows); // superior-esquerdo -> direita/baixo
    expect(tl.x).toBeGreaterThan(0);
    expect(tl.y).toBeGreaterThan(0);
    const br = cardOffset(26, 23, cols, rows); // inferior-direito -> esquerda/cima
    expect(br.x).toBeLessThan(0);
    expect(br.y).toBeLessThan(0);
  });

  it('ha exatamente 4 power-pellets no mapa (um por slot do tema)', () => {
    expect(POWER.length).toBe(4);
  });
});
