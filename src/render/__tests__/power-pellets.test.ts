import { describe, it, expect } from 'vitest';
import { POWER } from '../maze-layout.js';
import {
  powerPelletStyle,
  isCustomPowerPellet,
  POWER_PELLET_STYLES,
  cardOffset,
} from '../power-pellets.js';

/**
 * Garante que a customizacao individual dos power-pellets nao "desalinha" das
 * posicoes reais do labirinto: cada 'o' do maze-layout precisa ter um estilo
 * proprio (senao um canto viraria bolinha primitiva sem querer).
 */
describe('power-pellets — customizacao individual', () => {
  it('cada power-pellet do mapa tem um estilo proprio (card) com rotulo', () => {
    for (const p of POWER) {
      const style = powerPelletStyle(p.x, p.y);
      expect(isCustomPowerPellet(style), `power (${p.x},${p.y}) sem estilo proprio`).toBe(true);
      expect(style.label.length).toBeGreaterThan(0);
    }
  });

  it('nao ha estilos orfaos (todo estilo aponta para um power-pellet real)', () => {
    const real = new Set(POWER.map((p) => `${p.x},${p.y}`));
    for (const key of Object.keys(POWER_PELLET_STYLES)) {
      expect(real.has(key), `estilo "${key}" nao corresponde a nenhum power-pellet`).toBe(true);
    }
  });

  it('uma celula qualquer (nao-power) cai no estilo primitivo', () => {
    const style = powerPelletStyle(999, 999);
    expect(isCustomPowerPellet(style)).toBe(false);
  });

  it('cards customizados sao maiores que a bolinha primitiva', () => {
    const p = POWER[0]!;
    const custom = powerPelletStyle(p.x, p.y);
    const primitive = powerPelletStyle(999, 999);
    expect(custom.widthTiles).toBeGreaterThan(primitive.widthTiles);
  });

  it('o deslocamento do card aponta para dentro do labirinto', () => {
    // Canto superior-esquerdo -> empurra para a direita/baixo (valores positivos).
    const tl = cardOffset(1, 3, 28, 31);
    expect(tl.x).toBeGreaterThan(0);
    expect(tl.y).toBeGreaterThan(0);
    // Canto inferior-direito -> empurra para a esquerda/cima (valores negativos).
    const br = cardOffset(26, 23, 28, 31);
    expect(br.x).toBeLessThan(0);
    expect(br.y).toBeLessThan(0);
  });
});
