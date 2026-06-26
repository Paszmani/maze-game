/**
 * Tipos e validacao do theme.json (modulo 6).
 *
 * `resolveTheme(raw)` e o portao: recebe JSON arbitrario (de disco/rede, nao
 * confiavel) e devolve um `Theme` completo e tipado, caindo no default campo a
 * campo. O jogo NUNCA quebra por tema incompleto ou malformado — essa e a regra.
 * Funcao pura: zero Phaser, zero fetch. Testavel sem browser.
 *
 * Cores resolvem para number (0xRRGGBB, formato do Phaser); textos ficam string.
 * O core so recebe `gameplay` (numeros) — cores e sprites nunca chegam a logica.
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

export interface ThemeSprites {
  player: string | null;
  pellet: string | null;
  powerPellet: string | null;
  ghosts: string[];
}

export interface ThemeAudio {
  chomp: string | null;
  powerup: string | null;
  gameover: string | null;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  branding: ThemeBranding;
  gameplay: ThemeGameplay;
  sprites: ThemeSprites;
  audio: ThemeAudio;
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
    // aceita o nome do manifesto (pelletGlow) e o canonico (pellet)
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
  return {
    player: strOrNull(s.player, fb.player),
    pellet: strOrNull(s.pellet, fb.pellet),
    powerPellet: strOrNull(s.powerPellet, fb.powerPellet),
    ghosts: Array.isArray(s.ghosts) ? s.ghosts.filter((g): g is string => typeof g === 'string') : [...fb.ghosts],
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
  // Tema sem campos validos cai no minimo de negocio (nome + e-mail).
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
    leadForm: resolveLeadForm(r.leadForm, fallback.leadForm),
  };
}
