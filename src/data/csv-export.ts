/**
 * Serializacao de leads para CSV (funcao pura, testavel sem browser).
 *
 * Formato COMUM aos tres jogos (maze/memoria/rhythm), desenhado para o Excel
 * pt-BR: separador `;` (o padrao da localidade — com virgula tudo cai numa
 * coluna so), BOM UTF-8 na gravacao (CSV_BOM), data/hora locais em colunas
 * separadas (dd/mm/aaaa + hh:mm:ss) e cabecalhos em portugues, linhas em
 * ordem cronologica.
 *
 * Colunas = metadados fixos + UNIAO dos ids de campo de todos os leads (na
 * ordem em que aparecem) — leads de temas com formularios distintos consolidam
 * num mesmo CSV sem perder coluna. Mesmo formato gerado pelo Electron
 * (shell/csv.cjs).
 */

import type { Lead } from './lead-store.js';

const META_COLUMNS = ['data', 'hora', 'terminal', 'jogo', 'pontuacao'] as const;
const CSV_SEP = ';';

/** BOM (U+FEFF) para o Excel abrir UTF-8 com acentuacao correta. */
export const CSV_BOM = String.fromCharCode(0xfeff);

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** ISO 8601 -> [dd/mm/aaaa, hh:mm:ss] no fuso local (mantem o cru se invalido). */
function localDateTime(iso: string): [string, string] {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [iso, ''];
  return [
    `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
  ];
}

/** Escapa uma celula conforme RFC 4180 (aspas/separador/quebra de linha). */
function csvCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function leadsToCsv(leads: Lead[]): string {
  const sorted = [...leads].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const fieldIds: string[] = [];
  for (const lead of sorted) {
    for (const id of Object.keys(lead.fields)) {
      if (!fieldIds.includes(id)) fieldIds.push(id);
    }
  }

  const header = [...META_COLUMNS, ...fieldIds];
  const rows = sorted.map((lead) => {
    const [data, hora] = localDateTime(lead.timestamp);
    return [
      data,
      hora,
      lead.terminalId,
      lead.themeId,
      String(lead.score),
      ...fieldIds.map((id) => lead.fields[id] ?? ''),
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEP)).join('\r\n');
}
