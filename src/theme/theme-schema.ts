/**
 * Tipos e validacao do theme.json (modulos 6-7+).
 *
 * `resolveTheme(raw)` e o portao: recebe JSON arbitrario (de disco/rede, nao
 * confiavel) e devolve um `Theme` completo e tipado, caindo no default campo a
 * campo. O jogo NUNCA quebra por tema incompleto ou malformado — essa e a regra.
 * Funcao pura: zero Phaser, zero fetch. Testavel sem browser.
 *
 * Personalizacao coberta sem tocar codigo:
 *   - cores (incl. cada fantasma);
 *   - sprites (player, fantasmas, pellets, frightened, fundos) — caminhos de PNG;
 *   - branding (textos) e estilo completo da Attract (cor/tamanho/posicao/visivel);
 *   - campos do formulario de lead;
 *   - numeros de gameplay (o unico bloco que cruza para o core).
 */

import type { Personality } from '../core/ghost-ai.js';
import { DEFAULT_THEME } from './default-theme.js';

export type LeadFieldType = 'text' | 'email' | 'tel' | 'select' | 'checkbox';

export interface LeadField {
  id: string;
  label: string;
  type: LeadFieldType;
  required: boolean;
  maxLength?: number;
  options?: string[];
}

export interface ThemeColors {
  maze: number;
  background: number;
  pellet: number;
  power: number;
  player: number;
  frightened: number;
  eaten: number;
  uiAccent: number;
  text: string;
  ghosts: Record<Personality, number>;
}

export interface ThemeBranding {
  attractHeadline: string;
  ctaButton: string;
  leadHeadline: string;
  logo: string | null;
}

export interface ThemeGameplay {
  playerSpeed: number;
  ghostSpeed: number;
  powerDurationMs: number;
}

/** Caminhos de imagem (relativos a pasta do tema). `null` = usa forma primitiva. */
export interface ThemeSprites {
  player: string | null;
  pellet: string | null;
  powerPellet: string | null;
  frightened: string | null;
  ghosts: Record<Personality, string | null>;
  mazeBackground: string | null;
  attractBackground: string | null;
}

export interface ThemeAudio {
  chomp: string | null;
  powerup: string | null;
  gameover: string | null;
}

/** Estilo de um texto da Attract: cor, tamanho, posicao vertical (fracao 0..1). */
export interface AttractText {
  visible: boolean;
  color: number;
  size: number;
  y: number;
}

export interface AttractCta extends AttractText {
  background: number;
}

export interface AttractLogo {
  visible: boolean;
  scale: number;
  y: number;
}

export interface ThemeAttract {
  showPlayer: boolean;
  title: AttractText;
  headline: AttractText;
  cta: AttractCta;
  logo: AttractLogo;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  branding: ThemeBranding;
  gameplay: ThemeGameplay;
  sprites: ThemeSprites;
  audio: ThemeAudio;
  attract: ThemeAttract;
  leadForm: { fields: LeadField[] };
}

const GHOST_ORDER: ReadonlyArray<Personality> = ['blinky', 'pinky', 'inky', 'clyde'];
const LEAD_TYPES = new Set<LeadFieldType>(['text', 'email', 'tel', 'select', 'checkbox']);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fb: string): string => (typeof v === 'string' && v.length > 0 ? v : fb);

const strOrNull = (v: unknown, fb: string | null): string | null =>
  typeof v === 'string' && v.length > 0 ? v : fb;

const posNum = (v: unknown, fb: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fb;

const frac = (v: unknown, fb: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : fb;

const bool = (v: unknown, fb: boolean): boolean => (typeof v === 'boolean' ? v : fb);

function parseHex(v: unknown, fb: number): number {
  if (typeof v !== 'string') return fb;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(v.trim());
  return m ? parseInt(m[1]!, 16) : fb;
}

function resolveColors(raw: unknown, fb: ThemeColors): ThemeColors {
  const c = isObj(raw) ? raw : {};
  const ghosts: Record<Personality, number> = { ...fb.ghosts };
  const ghostsRaw = c.ghosts;
  if (Array.isArray(ghostsRaw)) {
    GHOST_ORDER.forEach((p, i) => (ghosts[p] = parseHex(ghostsRaw[i], fb.ghosts[p])));
  } else if (isObj(ghostsRaw)) {
    GHOST_ORDER.forEach((p) => (ghosts[p] = parseHex(ghostsRaw[p], fb.ghosts[p])));
  }
  return {
    maze: parseHex(c.maze, fb.maze),
    background: parseHex(c.background, fb.background),
    pellet: parseHex(c.pellet ?? c.pelletGlow, fb.pellet),
    power: parseHex(c.power, fb.power),
    player: parseHex(c.player, fb.player),
    frightened: parseHex(c.frightened, fb.frightened),
    eaten: parseHex(c.eaten, fb.eaten),
    uiAccent: parseHex(c.uiAccent, fb.uiAccent),
    text: str(c.text ?? c.textPrimary, fb.text),
    ghosts,
  };
}

function resolveBranding(raw: unknown, fb: ThemeBranding): ThemeBranding {
  const b = isObj(raw) ? raw : {};
  return {
    attractHeadline: str(b.attractHeadline, fb.attractHeadline),
    ctaButton: str(b.ctaButton, fb.ctaButton),
    leadHeadline: str(b.leadHeadline, fb.leadHeadline),
    logo: strOrNull(b.logo, fb.logo),
  };
}

function resolveGameplay(raw: unknown, fb: ThemeGameplay): ThemeGameplay {
  const g = isObj(raw) ? raw : {};
  return {
    playerSpeed: posNum(g.playerSpeed, fb.playerSpeed),
    ghostSpeed: posNum(g.ghostSpeed, fb.ghostSpeed),
    powerDurationMs: posNum(g.powerDurationMs, fb.powerDurationMs),
  };
}

function resolveSprites(raw: unknown, fb: ThemeSprites): ThemeSprites {
  const s = isObj(raw) ? raw : {};
  const ghosts: Record<Personality, string | null> = { ...fb.ghosts };
  const ghostsRaw = s.ghosts;
  if (Array.isArray(ghostsRaw)) {
    GHOST_ORDER.forEach((p, i) => (ghosts[p] = strOrNull(ghostsRaw[i], fb.ghosts[p])));
  } else if (isObj(ghostsRaw)) {
    GHOST_ORDER.forEach((p) => (ghosts[p] = strOrNull(ghostsRaw[p], fb.ghosts[p])));
  }
  return {
    player: strOrNull(s.player, fb.player),
    pellet: strOrNull(s.pellet, fb.pellet),
    powerPellet: strOrNull(s.powerPellet, fb.powerPellet),
    frightened: strOrNull(s.frightened, fb.frightened),
    ghosts,
    mazeBackground: strOrNull(s.mazeBackground, fb.mazeBackground),
    attractBackground: strOrNull(s.attractBackground, fb.attractBackground),
  };
}

function resolveAudio(raw: unknown, fb: ThemeAudio): ThemeAudio {
  const a = isObj(raw) ? raw : {};
  return {
    chomp: strOrNull(a.chomp, fb.chomp),
    powerup: strOrNull(a.powerup, fb.powerup),
    gameover: strOrNull(a.gameover, fb.gameover),
  };
}

function resolveAttractText(raw: unknown, fb: AttractText): AttractText {
  const o = isObj(raw) ? raw : {};
  return {
    visible: bool(o.visible, fb.visible),
    color: parseHex(o.color, fb.color),
    size: posNum(o.size, fb.size),
    y: frac(o.y, fb.y),
  };
}

function resolveAttract(raw: unknown, fb: ThemeAttract): ThemeAttract {
  const a = isObj(raw) ? raw : {};
  const ctaRaw = isObj(a.cta) ? a.cta : {};
  const logoRaw = isObj(a.logo) ? a.logo : {};
  return {
    showPlayer: bool(a.showPlayer, fb.showPlayer),
    title: resolveAttractText(a.title, fb.title),
    headline: resolveAttractText(a.headline, fb.headline),
    cta: { ...resolveAttractText(a.cta, fb.cta), background: parseHex(ctaRaw.background, fb.cta.background) },
    logo: {
      visible: bool(logoRaw.visible, fb.logo.visible),
      scale: posNum(logoRaw.scale, fb.logo.scale),
      y: frac(logoRaw.y, fb.logo.y),
    },
  };
}

function resolveField(v: unknown): LeadField | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== 'string' || v.id.length === 0) return null;
  if (typeof v.label !== 'string' || v.label.length === 0) return null;
  if (typeof v.type !== 'string' || !LEAD_TYPES.has(v.type as LeadFieldType)) return null;
  const field: LeadField = {
    id: v.id,
    label: v.label,
    type: v.type as LeadFieldType,
    required: v.required === true,
  };
  if (typeof v.maxLength === 'number' && Number.isFinite(v.maxLength)) field.maxLength = v.maxLength;
  if (Array.isArray(v.options)) field.options = v.options.filter((o): o is string => typeof o === 'string');
  return field;
}

function resolveLeadForm(raw: unknown, fb: { fields: LeadField[] }): { fields: LeadField[] } {
  const rawFields = isObj(raw) && Array.isArray(raw.fields) ? raw.fields : [];
  const fields = rawFields.map(resolveField).filter((f): f is LeadField => f !== null);
  return fields.length > 0 ? { fields } : { fields: fb.fields.map((f) => ({ ...f })) };
}

/** Mescla `raw` (nao confiavel) sobre `fallback`, validando campo a campo. */
export function resolveTheme(raw: unknown, fallback: Theme = DEFAULT_THEME): Theme {
  const r = isObj(raw) ? raw : {};
  return {
    id: str(r.id, fallback.id),
    name: str(r.name, fallback.name),
    colors: resolveColors(r.colors, fallback.colors),
    branding: resolveBranding(r.branding, fallback.branding),
    gameplay: resolveGameplay(r.gameplay, fallback.gameplay),
    sprites: resolveSprites(r.sprites, fallback.sprites),
    audio: resolveAudio(r.audio, fallback.audio),
    attract: resolveAttract(r.attract, fallback.attract),
    leadForm: resolveLeadForm(r.leadForm, fallback.leadForm),
  };
}
