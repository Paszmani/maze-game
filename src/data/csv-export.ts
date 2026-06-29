/**
 * Serializacao de leads para CSV (modulo 8). Funcao pura, testavel sem browser.
 *
 * Colunas = metadados fixos + UNIAO dos ids de campo de todos os leads (na ordem
 * em que aparecem). Assim, leads de temas diferentes (com formularios distintos)
 * consolidam num mesmo CSV sem perder coluna — um lead que nao tem um campo fica
 * com a celula vazia.
 */

import type { Lead } from './lead-store.js';

const META_COLUMNS = ['timestamp', 'terminalId', 'themeId', 'score'] as const;

/** Escapa uma celula conforme RFC 4180 (aspas/virgula/quebra de linha). */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function leadsToCsv(leads: Lead[]): string {
  const fieldIds: string[] = [];
  for (const lead of leads) {
    for (const id of Object.keys(lead.fields)) {
      if (!fieldIds.includes(id)) fieldIds.push(id);
    }
  }

  const header = [...META_COLUMNS, ...fieldIds];
  const rows = leads.map((lead) => [
    lead.timestamp,
    lead.terminalId,
    lead.themeId,
    String(lead.score),
    ...fieldIds.map((id) => lead.fields[id] ?? ''),
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
