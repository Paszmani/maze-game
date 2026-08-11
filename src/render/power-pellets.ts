/**
 * Customizacao INDIVIDUAL dos power-pellets (as "bolinhas grandes" dos cantos que
 * deixam os fantasmas comestiveis). Cada power-pellet e identificado pela sua
 * celula "x,y" (as mesmas posicoes 'o' do maze-layout) e pode ter:
 *   - um rotulo/cor proprios, desenhados como um "card" (padrao), ou
 *   - uma imagem PNG propria (`image`), que substitui o card.
 *
 * Os cards sao renderizados MAIORES que um pellet comum (em tiles) para ficarem
 * bem visiveis nos cantos, no espirito da imagem-modelo. Editar este arquivo
 * customiza cada power-pellet sem tocar no resto do jogo. As celulas sem estilo
 * proprio caem no `PRIMITIVE_STYLE` (bolinha classica).
 */

export interface PowerPelletStyle {
  /** Texto do card. Vazio => sem card (bolinha primitiva, salvo se houver `image`). */
  label: string;
  /** Cor de fundo do card (0xRRGGBB). */
  fill: number;
  /** Cor da borda do card. */
  accent: number;
  /** Cor do texto. */
  text: number;
  /** Caminho de imagem opcional (relativo a pasta do tema, ou data:/http). Substitui o card. */
  image: string | null;
  /** Largura do card/imagem em tiles. */
  widthTiles: number;
  /** Altura do card/imagem em tiles. */
  heightTiles: number;
}

const card = (o: Partial<PowerPelletStyle>): PowerPelletStyle => ({
  label: '',
  fill: 0xffcc00,
  accent: 0xffffff,
  text: 0x000000,
  image: null,
  widthTiles: 2.8,
  heightTiles: 1.7,
  ...o,
});

/**
 * Estilo por power-pellet, indexado pela celula "x,y". As quatro posicoes padrao
 * batem com os 'o' do maze-layout (cantos). Troque `label`/cores aqui, ou aponte
 * `image` para um PNG para usar arte propria naquele canto.
 */
export const POWER_PELLET_STYLES: Record<string, PowerPelletStyle> = {
  '1,3': card({ label: 'Amor', fill: 0x2f5fa6, accent: 0x9cc2f0, text: 0xffffff }),
  '26,3': card({ label: 'Amizade', fill: 0x6a3b9f, accent: 0xc39ae8, text: 0xffffff }),
  '1,23': card({ label: 'Paz', fill: 0x9aa0a6, accent: 0xeaedf0, text: 0x151515 }),
  '26,23': card({ label: 'Gratidão', fill: 0x2f8f5b, accent: 0x9ce8bd, text: 0xffffff }),
};

/** Fallback para power-pellets sem estilo proprio: a bolinha classica (pequena). */
export const PRIMITIVE_STYLE: PowerPelletStyle = card({ widthTiles: 1.1, heightTiles: 1.1 });

/** Estilo do power-pellet naquela celula (ou o primitivo, se nao customizado). */
export function powerPelletStyle(x: number, y: number): PowerPelletStyle {
  return POWER_PELLET_STYLES[`${x},${y}`] ?? PRIMITIVE_STYLE;
}

/** Tem card/imagem proprios? (Se nao, e a bolinha primitiva.) */
export function isCustomPowerPellet(style: PowerPelletStyle): boolean {
  return style.label !== '' || style.image !== null;
}

/**
 * Deslocamento (em tiles) do card para DENTRO do labirinto, afastando-o da borda
 * mais proxima — os power-pellets ficam nos cantos, entao o card cresceria por
 * cima da parede externa. Puxa em direcao ao centro para o card aparecer inteiro.
 */
export function cardOffset(x: number, y: number, cols: number, rows: number): { x: number; y: number } {
  return { x: x < cols / 2 ? 0.8 : -0.8, y: y < rows / 2 ? 0.5 : -0.5 };
}
