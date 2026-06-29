/**
 * Ponte de totem para Android (Capacitor). Implementa a MESMA interface
 * `KioskBridge` que o Electron expoe via preload, mas usando o Filesystem do
 * Capacitor. O `main.ts` instala isto em `window.kiosk` quando roda em Android
 * nativo, e todo o resto do jogo (theme-loader, lead-store, editor) funciona sem
 * saber em qual plataforma esta.
 *
 * Arquivos em `Directory.External` => /Android/data/<appId>/files/ no aparelho
 * (acessivel por USB/gerenciador de arquivos para o operador copiar os leads):
 *   config.json            { themeId, terminalId }
 *   themes/<id>/theme.json  + sprites (lidos e embutidos como data-URI no boot)
 *   leads/leads.csv         consolidado
 *   leads/raw/<...>.json     1 por lead
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { KioskBridge } from '../shell/bridge.js';
import type { Lead } from '../data/lead-store.js';
import { leadsToCsv } from '../data/csv-export.js';

const DIR = Directory.External;

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await Filesystem.readFile({ path, directory: DIR, encoding: Encoding.UTF8 });
    return JSON.parse(res.data as string) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function writeText(path: string, data: string): Promise<void> {
  await Filesystem.writeFile({ path, directory: DIR, data, encoding: Encoding.UTF8, recursive: true });
}

/** Le um arquivo de imagem do tema e devolve data-URI; mantem o valor se ja for absoluto. */
async function inlineSprite(dir: string, rel: unknown): Promise<unknown> {
  if (typeof rel !== 'string' || rel.length === 0 || /^(data:|https?:)/.test(rel)) return rel;
  try {
    const res = await Filesystem.readFile({ path: `${dir}/${rel}`, directory: DIR });
    const ext = rel.split('.').pop()?.toLowerCase() ?? '';
    const mime = MIME[ext] ?? 'application/octet-stream';
    return `data:${mime};base64,${res.data as string}`;
  } catch {
    return rel;
  }
}

async function inlineTheme(raw: Record<string, unknown>, dir: string): Promise<void> {
  const branding = raw.branding as Record<string, unknown> | undefined;
  if (branding) branding.logo = await inlineSprite(dir, branding.logo);

  const s = raw.sprites as Record<string, unknown> | undefined;
  if (!s) return;
  for (const k of ['player', 'pellet', 'powerPellet', 'frightened', 'mazeBackground', 'attractBackground']) {
    s[k] = await inlineSprite(dir, s[k]);
  }
  if (Array.isArray(s.ghosts)) {
    s.ghosts = await Promise.all((s.ghosts as unknown[]).map((g) => inlineSprite(dir, g)));
  } else if (s.ghosts && typeof s.ghosts === 'object') {
    const g = s.ghosts as Record<string, unknown>;
    for (const k of Object.keys(g)) g[k] = await inlineSprite(dir, g[k]);
  }
}

async function readAllLeads(): Promise<Lead[]> {
  try {
    const listing = await Filesystem.readdir({ path: 'leads/raw', directory: DIR });
    const out: Lead[] = [];
    for (const file of listing.files) {
      if (!file.name.endsWith('.json')) continue;
      const json = await readJson(`leads/raw/${file.name}`);
      if (json) out.push(json as unknown as Lead);
    }
    return out;
  } catch {
    return [];
  }
}

export function makeCapacitorBridge(): KioskBridge {
  return {
    isKiosk: true,

    async getConfig() {
      const cfg = (await readJson('config.json')) ?? {};
      return {
        terminalId: (cfg.terminalId as string) || 'totem-01',
        themeId: (cfg.themeId as string) || 'gsb-default',
      };
    },

    async loadTheme() {
      const cfg = (await readJson('config.json')) ?? {};
      const id = (cfg.themeId as string) || 'gsb-default';
      const raw = (await readJson(`themes/${id}/theme.json`)) ?? {};
      await inlineTheme(raw, `themes/${id}`);
      return raw;
    },

    async saveTheme(theme: unknown) {
      const t = (theme ?? {}) as Record<string, unknown>;
      const id = (typeof t.id === 'string' && t.id) || 'custom';
      await writeText(`themes/${id}/theme.json`, JSON.stringify(t, null, 2));
      const cfg = (await readJson('config.json')) ?? {};
      cfg.themeId = id;
      await writeText('config.json', JSON.stringify(cfg, null, 2));
      return { ok: true, id };
    },

    async saveLead(lead: Lead) {
      const stamp = (lead.timestamp || new Date().toISOString()).replace(/[:.]/g, '-');
      await writeText(`leads/raw/${stamp}-${lead.terminalId || 'totem'}.json`, JSON.stringify(lead, null, 2));
      // Regenera o CSV consolidado a partir dos JSONs (une colunas de schemas diferentes).
      await writeText('leads/leads.csv', leadsToCsv(await readAllLeads()));
    },

    async revealLeads() {
      // No Android os leads ficam em /Android/data/<appId>/files/leads (acessivel por USB).
      // Sem visualizador embutido aqui.
    },
  };
}
