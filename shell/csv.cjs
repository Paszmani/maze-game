/**
 * Serialização de leads para CSV (função pura, testável com Node puro).
 * Formato comum aos três jogos, desenhado para o Excel pt-BR: separador `;`,
 * BOM UTF-8 (na gravação), data/hora locais em colunas separadas, cabeçalhos
 * em português e linhas em ordem cronológica. Colunas = metadados fixos +
 * UNIÃO dos ids de campo de todos os leads (leads sem um campo ficam com a
 * célula vazia). Mesmo formato do renderer (src/data/csv-export.ts).
 */

const META_COLUMNS = ['data', 'hora', 'terminal', 'jogo', 'pontuacao'];
const CSV_SEP = ';';
const CSV_BOM = String.fromCharCode(0xfeff);

const pad2 = (n) => String(n).padStart(2, '0');

/** ISO 8601 -> [dd/mm/aaaa, hh:mm:ss] no fuso local (mantém o cru se inválido). */
function localDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [String(iso), ''];
  return [
    `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
  ];
}

/** Escapa uma célula conforme RFC 4180 (aspas/separador/quebra de linha). */
function csvCell(value) {
  const s = String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function leadsToCsv(leads) {
  const sorted = [...leads].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

  const fieldIds = [];
  for (const lead of sorted) {
    for (const id of Object.keys(lead.fields || {})) {
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
      ...fieldIds.map((id) => (lead.fields && lead.fields[id]) || ''),
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEP)).join('\r\n');
}

module.exports = { leadsToCsv, CSV_BOM };
