/**
 * Modos dos fantasmas e o cronograma global scatter/chase.
 *
 * O cronograma e dado puro e sem relogio proprio: ele responde "qual o modo base
 * no instante T?". Quem avanca o tempo e detecta as viradas e o game-state
 * (modulo 3) — aqui so mora a tabela e a consulta. Frightened e eaten nao entram
 * no cronograma; sao sobreposicoes acionadas por evento (power-pellet / captura).
 */

export type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten';

/** Modo base alternado pelo cronograma. */
export type BaseMode = 'scatter' | 'chase';

export interface SchedulePhase {
  readonly mode: BaseMode;
  /** Duracao em ms; `null` = fase final, dura para sempre. */
  readonly durationMs: number | null;
}

/**
 * Cronograma classico de nivel 1 (em ms). Termina em chase permanente — e por isso
 * que, no fim do nivel, os fantasmas nunca mais "desistem" da perseguicao.
 */
export const CLASSIC_LEVEL_1: ReadonlyArray<SchedulePhase> = [
  { mode: 'scatter', durationMs: 7_000 },
  { mode: 'chase', durationMs: 20_000 },
  { mode: 'scatter', durationMs: 7_000 },
  { mode: 'chase', durationMs: 20_000 },
  { mode: 'scatter', durationMs: 5_000 },
  { mode: 'chase', durationMs: 20_000 },
  { mode: 'scatter', durationMs: 5_000 },
  { mode: 'chase', durationMs: null },
];

export class ScatterChaseSchedule {
  private readonly phases: ReadonlyArray<SchedulePhase>;

  constructor(phases: ReadonlyArray<SchedulePhase> = CLASSIC_LEVEL_1) {
    if (phases.length === 0) throw new Error('ScatterChaseSchedule: sem fases.');
    this.phases = phases;
  }

  /** Modo base no tempo decorrido `elapsedMs` (>= 0). */
  modeAt(elapsedMs: number): BaseMode {
    let acc = 0;
    for (const phase of this.phases) {
      if (phase.durationMs === null) return phase.mode;
      acc += phase.durationMs;
      if (elapsedMs < acc) return phase.mode;
    }
    // So chega aqui se nenhuma fase for infinita; mantem o ultimo modo definido.
    return this.phases[this.phases.length - 1]!.mode;
  }
}
