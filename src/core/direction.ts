/**
 * Tipos geometricos compartilhados pelo core.
 *
 * Tudo aqui e agnostico de engine — nenhuma referencia a Phaser, pixels ou cores.
 * O core raciocina em celulas de grid (inteiros), nunca em coordenadas de tela.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const Direction = {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  None: 'none',
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

/** Deslocamento unitario em celulas para cada direcao. Y cresce para baixo. */
export const DIRECTION_VECTORS: Readonly<Record<Direction, Vec2>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

/** Direcao oposta — usada pela IA dos fantasmas (proibida de inverter) e por testes. */
export const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
  none: 'none',
};

export function isHorizontal(dir: Direction): boolean {
  return dir === Direction.Left || dir === Direction.Right;
}

export function addVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function equalsVec(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}
