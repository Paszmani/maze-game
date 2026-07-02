/**
 * Representacao do labirinto: grid de celulas, paredes e tuneis.
 *
 * O labirinto e dado puro. Nao sabe desenhar nada — entrega apenas perguntas
 * geometricas: "essa celula e parede?", "qual a proxima celula nessa direcao?".
 * A logica de tunel (wrap horizontal) vive aqui porque e geometria, nao render.
 */

import { Direction, DIRECTION_VECTORS, isHorizontal, type Vec2 } from './direction.js';

export type Tile = 'wall' | 'path' | 'tunnel' | 'door';

/**
 * Legenda ASCII para autoria de labirintos em testes e temas:
 *   '#' = parede
 *   'T' = celula de tunel (caminhavel; permite wrap para o lado oposto da linha)
 *   'D' = porta da casa dos fantasmas (bloqueada como parede no passo comum;
 *         so atravessavel por `step(..., { throughDoor: true })` — usada nas
 *         rotas roteirizadas de SAIDA do fantasma e de RETORNO dos olhos)
 *   qualquer outro caractere = caminho livre
 */
const TILE_FROM_CHAR = (char: string): Tile => {
  if (char === '#') return 'wall';
  if (char === 'T') return 'tunnel';
  if (char === 'D') return 'door';
  return 'path';
};

/** Opcoes de `step`. `throughDoor` permite atravessar a porta da casa. */
export interface StepOptions {
  throughDoor?: boolean;
}

export class Maze {
  readonly width: number;
  readonly height: number;
  /** Indexado [y][x]. Imutavel apos construcao. */
  private readonly tiles: ReadonlyArray<ReadonlyArray<Tile>>;

  constructor(tiles: Tile[][]) {
    if (tiles.length === 0 || tiles[0]!.length === 0) {
      throw new Error('Maze: grid vazio.');
    }
    const width = tiles[0]!.length;
    for (const row of tiles) {
      if (row.length !== width) {
        throw new Error('Maze: grid nao retangular — todas as linhas devem ter a mesma largura.');
      }
    }
    this.tiles = tiles.map((row) => [...row]);
    this.height = tiles.length;
    this.width = width;
  }

  /** Constroi a partir de linhas ASCII. Veja a legenda em TILE_FROM_CHAR. */
  static fromAscii(rows: string[]): Maze {
    if (rows.length === 0) throw new Error('Maze.fromAscii: nenhuma linha fornecida.');
    const grid = rows.map((row) => [...row].map(TILE_FROM_CHAR));
    return new Maze(grid);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Celula fora do grid conta como parede — simplifica colisao nas bordas. */
  tileAt(x: number, y: number): Tile {
    if (!this.inBounds(x, y)) return 'wall';
    return this.tiles[y]![x]!;
  }

  isWall(x: number, y: number): boolean {
    return this.tileAt(x, y) === 'wall';
  }

  isTunnel(x: number, y: number): boolean {
    return this.tileAt(x, y) === 'tunnel';
  }

  /** Porta da casa dos fantasmas — bloqueada no passo comum, so passa com throughDoor. */
  isDoor(x: number, y: number): boolean {
    return this.tileAt(x, y) === 'door';
  }

  /**
   * Caminhavel no passo COMUM = dentro do grid, nao-parede e nao-porta. A porta
   * so e transponivel pelas rotas de fantasma (saida/retorno), nunca pelo jogador
   * nem pela IA normal.
   */
  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && !this.isWall(x, y) && !this.isDoor(x, y);
  }

  /**
   * Proxima celula caminhavel saindo de `from` na direcao `dir`.
   *
   * Retorna `null` se o passo for bloqueado (parede, porta, ou borda nao-tunel).
   * `opts.throughDoor` libera a porta da casa (rota de fantasma). Em uma celula de
   * tunel, sair horizontalmente pela borda faz wrap para a borda oposta na mesma
   * linha (se caminhavel).
   */
  step(from: Vec2, dir: Direction, opts: StepOptions = {}): Vec2 | null {
    if (dir === Direction.None) return null;

    const delta = DIRECTION_VECTORS[dir];
    const target: Vec2 = { x: from.x + delta.x, y: from.y + delta.y };

    if (this.inBounds(target.x, target.y)) {
      if (this.isWall(target.x, target.y)) return null;
      if (this.isDoor(target.x, target.y) && !opts.throughDoor) return null;
      return target;
    }

    // Fora do grid: so e valido como tunel (wrap horizontal a partir de uma celula de tunel).
    if (this.isTunnel(from.x, from.y) && isHorizontal(dir)) {
      const wrappedX = target.x < 0 ? this.width - 1 : 0;
      if (this.isWalkable(wrappedX, from.y)) {
        return { x: wrappedX, y: from.y };
      }
    }

    return null;
  }
}
