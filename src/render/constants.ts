/**
 * Constantes estruturais de render (pixels). As cores agora vivem no tema
 * (theme.json -> resolveTheme), nao mais aqui — trocar de marca nao toca codigo.
 */

/** Largura da celula (e base de tamanho dos sprites/traços). */
export const TILE = 24;
/**
 * Altura da celula. Menor que `TILE` => o mapa fica "achatado" na vertical, sem
 * mudar a grade/layout. Com 28x31, TILE_Y = 22 deixa o campo ~quadrado
 * (28*24 = 672 de largura x 31*22 = 682 de altura). Ajuste este valor para
 * achatar mais (menor) ou menos (mais perto de TILE).
 */
export const TILE_Y = 22;
export const HUD_HEIGHT = 48;

/** Sem interacao por este tempo -> volta ao attract (regra de totem). */
export const INACTIVITY_MS = 30_000;
