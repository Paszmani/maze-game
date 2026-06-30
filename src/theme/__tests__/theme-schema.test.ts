import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../theme-schema.js';
import { DEFAULT_THEME } from '../default-theme.js';

describe('resolveTheme — fallback e validacao', () => {
  it('entrada vazia devolve o tema default', () => {
    const t = resolveTheme({});
    expect(t.colors.maze).toBe(DEFAULT_THEME.colors.maze);
    expect(t.gameplay.powerDurationMs).toBe(DEFAULT_THEME.gameplay.powerDurationMs);
    expect(t.leadForm.fields).toHaveLength(DEFAULT_THEME.leadForm.fields.length);
  });

  it('entrada nao-objeto (null/string/number) devolve default', () => {
    expect(resolveTheme(null).colors.maze).toBe(DEFAULT_THEME.colors.maze);
    expect(resolveTheme('nope').id).toBe(DEFAULT_THEME.id);
    expect(resolveTheme(42).name).toBe(DEFAULT_THEME.name);
  });

  it('mescla cores parciais, mantendo o resto no default', () => {
    const t = resolveTheme({ colors: { maze: '#000000' } });
    expect(t.colors.maze).toBe(0x000000);
    expect(t.colors.player).toBe(DEFAULT_THEME.colors.player);
  });

  it('converte hex para number e aceita sem #', () => {
    expect(resolveTheme({ colors: { maze: '#123456' } }).colors.maze).toBe(0x123456);
    expect(resolveTheme({ colors: { maze: 'abcdef' } }).colors.maze).toBe(0xabcdef);
  });

  it('cor invalida cai no default', () => {
    expect(resolveTheme({ colors: { maze: 'roxo' } }).colors.maze).toBe(DEFAULT_THEME.colors.maze);
    expect(resolveTheme({ colors: { maze: '#12' } }).colors.maze).toBe(DEFAULT_THEME.colors.maze);
  });

  it('aceita os aliases do manifesto (pelletGlow, textPrimary)', () => {
    const t = resolveTheme({ colors: { pelletGlow: '#abcdef', textPrimary: '#101010' } });
    expect(t.colors.pellet).toBe(0xabcdef);
    expect(t.colors.text).toBe('#101010');
  });

  it('mapeia o array de cores dos fantasmas por ordem', () => {
    const t = resolveTheme({ colors: { ghosts: ['#010101', '#020202', '#030303', '#040404'] } });
    expect(t.colors.ghosts.blinky).toBe(0x010101);
    expect(t.colors.ghosts.clyde).toBe(0x040404);
  });

  it('gameplay invalido cai no default; valido e usado', () => {
    expect(resolveTheme({ gameplay: { playerSpeed: 'rapido' } }).gameplay.playerSpeed).toBe(
      DEFAULT_THEME.gameplay.playerSpeed,
    );
    expect(resolveTheme({ gameplay: { playerSpeed: -3 } }).gameplay.playerSpeed).toBe(
      DEFAULT_THEME.gameplay.playerSpeed,
    );
    expect(resolveTheme({ gameplay: { playerSpeed: 1.5 } }).gameplay.playerSpeed).toBe(1.5);
  });

  it('leadForm valido e usado', () => {
    const t = resolveTheme({
      leadForm: {
        fields: [
          { id: 'name', label: 'Nome', type: 'text', required: true },
          { id: 'tel', label: 'Telefone', type: 'tel' },
        ],
      },
    });
    expect(t.leadForm.fields).toHaveLength(2);
    expect(t.leadForm.fields[1]!.required).toBe(false); // default quando ausente
  });

  it('descarta campos de lead invalidos; sem nenhum valido, cai no default', () => {
    const t = resolveTheme({
      leadForm: { fields: [{ id: 'x', label: 'X', type: 'inexistente' }, { label: 'sem id', type: 'text' }] },
    });
    expect(t.leadForm.fields).toHaveLength(DEFAULT_THEME.leadForm.fields.length);
  });

  it('mantem um campo valido mesmo havendo invalidos junto', () => {
    const t = resolveTheme({
      leadForm: {
        fields: [
          { id: 'name', label: 'Nome', type: 'text', required: true },
          { id: 'bad', label: 'Ruim', type: 'xyz' },
        ],
      },
    });
    expect(t.leadForm.fields).toHaveLength(1);
    expect(t.leadForm.fields[0]!.id).toBe('name');
  });

  it('nao muta o tema default ao resolver', () => {
    const before = DEFAULT_THEME.colors.maze;
    resolveTheme({ colors: { maze: '#000000' } });
    expect(DEFAULT_THEME.colors.maze).toBe(before);
  });
});

describe('resolveTheme — sprites', () => {
  it('sem sprites, tudo null (forma primitiva)', () => {
    const t = resolveTheme({});
    expect(t.sprites.player).toBeNull();
    expect(t.sprites.ghosts.blinky).toBeNull();
  });

  it('aceita caminhos de sprite e mapeia fantasmas por array', () => {
    const t = resolveTheme({
      sprites: { player: 'p.png', ghosts: ['b.png', 'pk.png', 'i.png', 'c.png'] },
    });
    expect(t.sprites.player).toBe('p.png');
    expect(t.sprites.ghosts.blinky).toBe('b.png');
    expect(t.sprites.ghosts.clyde).toBe('c.png');
  });

  it('aceita fantasmas por objeto (parcial), resto null', () => {
    const t = resolveTheme({ sprites: { ghosts: { blinky: 'b.png' } } });
    expect(t.sprites.ghosts.blinky).toBe('b.png');
    expect(t.sprites.ghosts.pinky).toBeNull();
  });

  it('descarta caminho nao-string', () => {
    const t = resolveTheme({ sprites: { player: 123 } });
    expect(t.sprites.player).toBeNull();
  });

  it('aceita o sprite da fruta', () => {
    expect(resolveTheme({ sprites: { fruit: 'cereja.png' } }).sprites.fruit).toBe('cereja.png');
    expect(resolveTheme({}).sprites.fruit).toBeNull();
  });
});

describe('resolveTheme — attract (estilo)', () => {
  it('default completo quando ausente', () => {
    const t = resolveTheme({});
    expect(t.attract.title.visible).toBe(true);
    expect(t.attract.cta.background).toBe(DEFAULT_THEME.attract.cta.background);
    expect(t.attract.showPlayer).toBe(true);
  });

  it('mescla overrides parciais', () => {
    const t = resolveTheme({
      attract: { showPlayer: false, title: { visible: false }, cta: { color: '#101010', background: '#202020' } },
    });
    expect(t.attract.showPlayer).toBe(false);
    expect(t.attract.title.visible).toBe(false);
    expect(t.attract.cta.color).toBe(0x101010);
    expect(t.attract.cta.background).toBe(0x202020);
    // campos nao informados mantem default
    expect(t.attract.headline.size).toBe(DEFAULT_THEME.attract.headline.size);
  });

  it('valida y como fracao 0..1; fora disso cai no default', () => {
    expect(resolveTheme({ attract: { title: { y: 0.75 } } }).attract.title.y).toBe(0.75);
    expect(resolveTheme({ attract: { title: { y: 5 } } }).attract.title.y).toBe(DEFAULT_THEME.attract.title.y);
    expect(resolveTheme({ attract: { title: { y: -1 } } }).attract.title.y).toBe(DEFAULT_THEME.attract.title.y);
  });
});
