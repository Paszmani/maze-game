import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadActiveTheme, loadAppliedTheme, APPLIED_KEY } from '../theme-loader.js';

/**
 * Regressao do bug "as edicoes nao ficam salvas ao voltar ao jogo": no web, o
 * tema APLICADO pelo editor (localStorage) precisa ter prioridade sobre o arquivo
 * servido — a menos que `?theme=` selecione uma marca explicitamente.
 *
 * O loader le `window`/`localStorage`/`fetch` globais; aqui eles sao stubados
 * (ambiente de teste = node).
 */
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

const g = globalThis as unknown as {
  window: { location: { search: string }; kiosk?: unknown };
  localStorage: MemStorage;
  fetch: unknown;
};

beforeEach(() => {
  g.window = { location: { search: '' } };
  g.localStorage = new MemStorage();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('theme-loader — tema aplicado persiste (web)', () => {
  it('loadAppliedTheme: null sem nada salvo; objeto apos salvar', () => {
    expect(loadAppliedTheme()).toBeNull();
    g.localStorage.setItem(APPLIED_KEY, JSON.stringify({ name: 'Marca Salva' }));
    expect(loadAppliedTheme()).toEqual({ name: 'Marca Salva' });
  });

  it('sem ?theme: usa o tema aplicado do localStorage (base vazia, sem fetch)', async () => {
    const fetchSpy = vi.fn();
    g.fetch = fetchSpy;
    g.localStorage.setItem(APPLIED_KEY, JSON.stringify({ name: 'Tema do Editor' }));

    const { theme, base } = await loadActiveTheme();

    expect(theme.name).toBe('Tema do Editor');
    expect(base).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled(); // nao caiu no arquivo servido
  });

  it('com ?theme=<id> explicito: busca o arquivo servido e ignora o aplicado', async () => {
    g.window.location.search = '?theme=cliente-exemplo';
    g.localStorage.setItem(APPLIED_KEY, JSON.stringify({ name: 'Nao Use Este' }));
    g.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ name: 'Do Arquivo' }) }));

    const { theme, base } = await loadActiveTheme();

    expect(theme.name).toBe('Do Arquivo');
    expect(base).toBe('themes/cliente-exemplo/');
  });
});
