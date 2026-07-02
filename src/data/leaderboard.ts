/**
 * Placar local (leaderboard). Independente do LeadStore de proposito: o lead vai
 * para disco/CSV (produto de negocio), enquanto o placar e uma copia enxuta
 * (nome + pontuacao) SEMPRE em localStorage — assim aparece na hora, tanto no
 * navegador quanto no totem (Electron/Android tem localStorage no webview).
 *
 * Puro e testavel: recebe um `Storage` injetavel (default `window.localStorage`).
 */

export interface LeaderboardEntry {
  name: string;
  score: number;
  /** ISO 8601 — desempate por mais recente e util para depurar. */
  timestamp: string;
}

const KEY = 'kioskMazeLeaderboard';
const MAX_ENTRIES = 100; // teto de armazenamento; o placar exibe muito menos
const NAME_MAX = 24;

function cleanName(raw: string): string {
  const n = raw.trim().slice(0, NAME_MAX);
  return n.length > 0 ? n : 'Anonimo';
}

export class Leaderboard {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    private readonly key = KEY,
  ) {}

  /** Registra uma pontuacao. Nome vazio vira "Anonimo"; poda o historico ao teto. */
  add(name: string, score: number, timestamp: string): void {
    const entries = this.all();
    entries.push({ name: cleanName(name), score: Math.max(0, Math.floor(score)), timestamp });
    // Guarda so os melhores (por teto de armazenamento).
    entries.sort((a, b) => b.score - a.score);
    this.storage.setItem(this.key, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  }

  all(): LeaderboardEntry[] {
    try {
      const raw = this.storage.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return (parsed as LeaderboardEntry[]).filter(
        (e) => e && typeof e.name === 'string' && typeof e.score === 'number',
      );
    } catch {
      return [];
    }
  }

  /** Melhores `limit` pontuacoes, desc. Empate: mais recente primeiro. */
  top(limit = 10): LeaderboardEntry[] {
    return this.all()
      .sort((a, b) => b.score - a.score || b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}

/** Placar apoiado no localStorage do dispositivo (web e totem). */
export function createLeaderboard(): Leaderboard {
  return new Leaderboard(window.localStorage);
}
