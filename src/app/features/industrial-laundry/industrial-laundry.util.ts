import { HttpErrorResponse } from '@angular/common/http';
import {
  IlrCertificationStatus,
  IlrDecimal,
  IlrLifecycleState,
  IlrPpeStatus,
  IlrProblem,
  IlrScanRead,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance, sales and warehouse roles read; finance and floor staff write. */
export const INDUSTRIAL_LAUNDRY_MODULE = 'industrial_laundry';

/** Module key of the finance ability: consolidating the monthly bill and drafting its invoice. */
export const INDUSTRIAL_LAUNDRY_FINANCE_MODULE = 'industrial_laundry_finance';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface IlrOutcome {
  ok: boolean;
  /** Translation key of the refusal (`industrialLaundry.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  /** The parameters the API sent with the problem (the weights of a gross below the tare, a locker code). */
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const ILR_OK: IlrOutcome = { ok: true, errorKey: null, detail: null, params: {}, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `industrialLaundry.error.${code ? code : 'generic'}`;
}

/** Strips null entries from dynamic translation parameter maps so TranslatePipe receives only string | number values. */
export function scalarParams(
  params: Record<string, string | number | null> | undefined,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null) {
      result[key] = value;
    }
  }
  return result;
}

export function problemOf(error: unknown): IlrProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as IlrProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): IlrOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    detail: first ?? problem?.detail ?? null,
    params: problem?.params ?? {},
    errors,
  };
}

// --- Numbers ---

export function num(value: IlrDecimal | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Net weight of a roll cage as the API computes it (gross - tare, three decimals); null while the weighing is not valid. */
export function netWeight(
  gross: IlrDecimal | null | undefined,
  tare: IlrDecimal | null | undefined,
): number | null {
  if (gross === null || gross === undefined || gross === '') {
    return null;
  }
  const grossValue = num(gross);
  const tareValue = num(tare);
  if (grossValue < 0 || tareValue < 0 || grossValue < tareValue) {
    return null;
  }
  return Math.round((grossValue - tareValue) * 1000) / 1000;
}

/** Share of the certified wash cycles a garment used, in percent (can pass 100 for a garment past its limit). */
export function wearPercent(cycles: number, limit: number | null): number {
  if (limit === null || limit <= 0) {
    return 0;
  }
  return Math.round((cycles / limit) * 100);
}

// --- Scan console ---

/**
 * Reads typed or pasted in the scan console, one tag per line: the EPC, then optionally the RSSI in dBm and the antenna,
 * separated by commas, semicolons, tabs or spaces. Blank lines are ignored; what is not an EPC is left for the API to refuse.
 */
export function parseReads(text: string): IlrScanRead[] {
  const reads: IlrScanRead[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [epc, rssi, antenna] = line
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter((part) => part !== '');
    if (epc === undefined) {
      continue;
    }
    const signal = rssi === undefined ? Number.NaN : Number.parseFloat(rssi);
    reads.push({
      epc,
      rssi: Number.isFinite(signal) ? signal : null,
      antenna_id: antenna ?? null,
    });
  }
  return reads;
}

// --- Colours ---

const LIFECYCLE_COLORS: Record<IlrLifecycleState, string> = {
  clean_in_stock: 'green',
  delivered_to_customer: 'blue',
  soiled_returned: 'orange',
  in_wash_tunnel: 'cyan',
  in_mending: 'gold',
  condemned_rag: 'red',
};

export function lifecycleColor(state: IlrLifecycleState): string {
  return LIFECYCLE_COLORS[state] ?? 'default';
}

export function ppeStatusColor(status: IlrPpeStatus): string {
  return status === 'limit_reached' ? 'red' : 'orange';
}

const CERTIFICATION_COLORS: Record<IlrCertificationStatus, string> = {
  pending: 'default',
  compliant: 'green',
  non_compliant: 'red',
};

export function certificationColor(status: IlrCertificationStatus): string {
  return CERTIFICATION_COLORS[status] ?? 'default';
}

export function severityColor(severity: 'warning' | 'blocking'): string {
  return severity === 'blocking' ? 'red' : 'orange';
}

/** Gap of the circulating stock against the par level: missing garments are red, a surplus is blue. */
export function gapColor(gap: number): string {
  if (gap > 0) {
    return 'red';
  }
  return gap < 0 ? 'blue' : 'green';
}

/** A dormant garment turns red when it is twice past its threshold, orange before. */
export function dormantColor(days: number, threshold: number): string {
  return days >= threshold * 2 ? 'red' : 'orange';
}

// --- Dates ---

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** First and last day of the month of a date, as ISO dates. */
export function monthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

/** First and last day of the previous month, the usual period of a monthly bill. */
export function previousMonthRange(today: Date = new Date()): { start: string; end: string } {
  return monthRange(new Date(today.getFullYear(), today.getMonth() - 1, 1));
}
