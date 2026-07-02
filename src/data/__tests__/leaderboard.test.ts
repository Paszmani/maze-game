import { describe, it, expect } from 'vitest';
import { Leaderboard } from '../leaderboard.js';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

const lb = () => new Leaderboard(new MemStorage());

describe('Leaderboard', () => {
  it('vazio retorna lista vazia', () => {
    expect(lb().top()).toEqual([]);
  });

  it('ordena por pontuacao desc e respeita o limite', () => {
    const board = lb();
    board.add('Ana', 100, '2026-01-01T00:00:00Z');
    board.add('Bia', 300, '2026-01-01T00:01:00Z');
    board.add('Cal', 200, '2026-01-01T00:02:00Z');
    const top2 = board.top(2);
    expect(top2.map((e) => e.name)).toEqual(['Bia', 'Cal']);
    expect(top2.map((e) => e.score)).toEqual([300, 200]);
  });

  it('nome vazio vira "Anonimo"; pontuacao e normalizada (>=0, inteiro)', () => {
    const board = lb();
    board.add('   ', 12.9, '2026-01-01T00:00:00Z');
    board.add('Dex', -5, '2026-01-01T00:01:00Z');
    const all = board.top();
    expect(all.find((e) => e.score === 12)?.name).toBe('Anonimo');
    expect(all.find((e) => e.name === 'Dex')?.score).toBe(0);
  });

  it('empate de pontuacao: mais recente primeiro', () => {
    const board = lb();
    board.add('Velho', 50, '2026-01-01T00:00:00Z');
    board.add('Novo', 50, '2026-01-02T00:00:00Z');
    expect(board.top()[0]!.name).toBe('Novo');
  });

  it('persiste entre instancias sobre o mesmo storage', () => {
    const storage = new MemStorage();
    new Leaderboard(storage).add('Eva', 999, '2026-01-01T00:00:00Z');
    expect(new Leaderboard(storage).top()[0]).toMatchObject({ name: 'Eva', score: 999 });
  });
});
