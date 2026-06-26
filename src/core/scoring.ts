/**
 * Pontuacao, combos e a tabela de pontos. Dado puro, sem nocao de tempo ou render.
 *
 * O combo de fantasmas e a unica peca com estado interno: comer fantasmas em
 * sequencia durante um mesmo frightened dobra o valor (200 -> 400 -> 800 -> 1600).
 * Quem zera essa cadeia (fim do frightened, nova power-pellet, morte) e o
 * game-state — aqui so guardamos o contador e a tabela.
 */

export const POINTS = {
  pellet: 10,
  powerPellet: 50,
  /** Valor por fantasma na cadeia atual; satura no ultimo. */
  ghostChain: [200, 400, 800, 1600] as const,
} as const;

export class Scoring {
  score = 0;
  private chain = 0;

  eatPellet(): number {
    this.score += POINTS.pellet;
    return POINTS.pellet;
  }

  eatPowerPellet(): number {
    this.score += POINTS.powerPellet;
    return POINTS.powerPellet;
  }

  /** Pontua o proximo fantasma da cadeia e avanca o combo. */
  eatGhost(): number {
    const idx = Math.min(this.chain, POINTS.ghostChain.length - 1);
    const pts = POINTS.ghostChain[idx]!;
    this.score += pts;
    this.chain += 1;
    return pts;
  }

  resetGhostChain(): void {
    this.chain = 0;
  }

  get ghostChain(): number {
    return this.chain;
  }

  reset(): void {
    this.score = 0;
    this.chain = 0;
  }
}
