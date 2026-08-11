/**
 * Layout dos power-pellets customizados. O QUE cada um mostra e definido pelo
 * tema (`sprites.powerPellets[i]`, 4 slots na ordem dos cantos, editaveis no
 * editor de tema). Aqui fica so a GEOMETRIA aprovada: o tamanho-alvo do card e o
 * deslocamento para dentro do labirinto — sem rotulo/cor fixos.
 *
 * Padrao: sem imagem => bolinha classica (render em GameScene). Com imagem => ela
 * e desenhada nesse tamanho-alvo, preservando a proporcao (responsivo).
 */

/** Caixa-alvo (em tiles) do power-pellet customizado. A imagem cabe dentro dela. */
export const POWER_PELLET_CARD = { widthTiles: 2.8, heightTiles: 1.7 } as const;

/**
 * Deslocamento (em tiles) do card para DENTRO do labirinto, afastando-o da borda
 * mais proxima — os power-pellets ficam nos cantos, entao um card grande cresceria
 * por cima da parede externa. Puxa em direcao ao centro para aparecer inteiro.
 */
export function cardOffset(x: number, y: number, cols: number, rows: number): { x: number; y: number } {
  return { x: x < cols / 2 ? 0.8 : -0.8, y: y < rows / 2 ? 0.5 : -0.5 };
}
