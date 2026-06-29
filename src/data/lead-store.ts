/**
 * Persistencia de lead (modulo 8).
 *
 * Schema-agnostica: um lead e um mapa `id -> valor` (as respostas do formulario,
 * que variam por tema) mais metadados fixos (terminal, tema, score, timestamp).
 * Adicionar um campo no theme.json NAO exige mudanca aqui.
 *
 * No dev/browser usamos `WebLeadStore` (localStorage). No Electron (modulo 9) entra
 * um store em disco via fs (JSON-por-lead + CSV consolidado) implementando a mesma
 * interface. A serializacao CSV mora em csv-export.ts (pura, testavel).
 */

export interface Lead {
  /** Respostas do formulario: id do campo -> valor. */
  fields: Record<string, string>;
  score: number;
  terminalId: string;
  themeId: string;
  /** ISO 8601. */
  timestamp: string;
}

export interface LeadStore {
  save(lead: Lead): void;
  all(): Lead[];
  clear(): void;
}

/**
 * Store sobre um backend `Storage` (localStorage por padrao; injetavel para teste).
 * Append simples num array JSON.
 */
export class WebLeadStore implements LeadStore {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    private readonly key = 'kioskMazeLeads',
  ) {}

  save(lead: Lead): void {
    const all = this.all();
    all.push(lead);
    this.storage.setItem(this.key, JSON.stringify(all));
  }

  all(): Lead[] {
    try {
      const raw = this.storage.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as Lead[]) : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}

/**
 * Store nativo (Electron ou Android/Capacitor): grava em disco via a ponte
 * `window.kiosk` (que o preload do Electron ou o Capacitor populam). A serializacao
 * em arquivo/CSV roda do outro lado da ponte.
 */
class NativeLeadStore implements LeadStore {
  constructor(private readonly bridge: { saveLead(lead: Lead): Promise<void> }) {}
  save(lead: Lead): void {
    void this.bridge.saveLead(lead).catch(() => {});
  }
  all(): Lead[] {
    return []; // fonte de verdade fica no disco (CSV consolidado)
  }
  clear(): void {}
}

export function createLeadStore(): LeadStore {
  const kiosk = window.kiosk;
  return kiosk ? new NativeLeadStore(kiosk) : new WebLeadStore(window.localStorage);
}

/** Identifica a maquina de origem do lead. `?terminal=<id>`, default 'totem-01'. */
export function terminalId(): string {
  const p = new URLSearchParams(window.location.search).get('terminal');
  return p && p.length > 0 ? p : 'totem-01';
}
