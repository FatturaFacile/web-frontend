import { HttpErrorResponse } from '@angular/common/http';
import {
  BwAeoStatus,
  BwCustomsStatus,
  BwDiscrepancyStatus,
  BwProblem,
  BwVatMovementType,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): the customs manager and finance roles write, warehouse and operations managers read. */
export const BONDED_WAREHOUSES_MODULE = 'bonded_warehouses';

/** CGU utilization above which the plafond is a warning (orange) and a critical alert (red). */
export const CGU_WARNING_PERCENT = 80;
export const CGU_CRITICAL_PERCENT = 95;

/** What a store write answers: the screens show the translated error. */
export interface BwOutcome {
  ok: boolean;
  /** Translation key of the refusal (`bondedWarehouses.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  /** Values the API reports with the refusal (ceiling, available, requested...): the placeholders of the text. */
  params: Record<string, string>;
}

export const BW_OK: BwOutcome = { ok: true, errorKey: null, code: null, params: {} };

export function errorKey(code: string | null | undefined): string {
  return `bondedWarehouses.error.${code ? code : 'unknown'}`;
}

export function problemOf(error: unknown): BwProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as BwProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, its context fills the placeholders. */
export function failureOf(error: unknown): BwOutcome {
  const problem = problemOf(error);
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(problem?.context ?? {})) {
    params[key] = value === null || value === undefined ? '' : String(value);
  }
  return { ok: false, errorKey: errorKey(problem?.code), code: problem?.code ?? null, params };
}

export function toNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** NG-ZORRO progress status of the CGU utilization. */
export function utilizationStatus(percent: number): 'success' | 'normal' | 'exception' {
  if (percent >= CGU_CRITICAL_PERCENT) {
    return 'exception';
  }
  return percent >= CGU_WARNING_PERCENT ? 'normal' : 'success';
}

/** Colour of the CGU gauge stroke. */
export function utilizationColor(percent: number): string {
  if (percent >= CGU_CRITICAL_PERCENT) {
    return '#f5222d';
  }
  return percent >= CGU_WARNING_PERCENT ? '#fa8c16' : '#52c41a';
}

/** NG-ZORRO tag colour of the customs status of a lot. */
export function customsStatusColor(status: BwCustomsStatus | null | undefined): string {
  switch (status) {
    case 'NonUnion_Suspended':
      return 'blue';
    case 'UsualHandling_InProgress':
      return 'purple';
    case 'PartiallyDischarged':
      return 'orange';
    case 'FullyDischarged':
      return 'green';
    default:
      return 'default';
  }
}

/** NG-ZORRO tag colour of an audit finding. */
export function discrepancyColor(status: BwDiscrepancyStatus | null | undefined): string {
  switch (status) {
    case 'Matched':
      return 'green';
    case 'Minor_Variance':
      return 'orange';
    case 'Critical_Alert_ADM_UDSC':
      return 'red';
    default:
      return 'default';
  }
}

export function aeoColor(status: BwAeoStatus | null | undefined): string {
  return status === null || status === undefined || status === 'None' ? 'default' : 'geekblue';
}

export function isExtraction(type: BwVatMovementType): boolean {
  return (
    type === 'Extraction_TD22' || type === 'Extraction_TD23' || type === 'Extraction_LetterOfIntent'
  );
}

/** Today as `YYYY-MM-DD` in the local time zone (the default of the date fields). */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Normalizes a typed MRN the way the API does: no blanks, upper case. */
export function normalizeMrn(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** Format of an MRN: 2 digits (year), 2 letters (country), 14 alphanumerics. */
export function isValidMrn(value: string): boolean {
  return /^\d{2}[A-Z]{2}[A-Z0-9]{14}$/.test(normalizeMrn(value));
}

/** TARIC / combined nomenclature code: 8 or 10 digits. */
export function isValidTaric(value: string): boolean {
  return /^\d{8}(\d{2})?$/.test(value);
}

/** Taxable base of an extraction from an IVA warehouse (Art. 50-bis c. 4): the goods plus the storage and processing services. */
export function extractionBase(goods: number, services: number): number {
  return Math.round((goods + services) * 100) / 100;
}

export function extractionVat(base: number, ratePercent: number): number {
  return Math.round(base * ratePercent) / 100;
}

/** Codes the reconciliation writes in the findings and corrective action columns (`bondedWarehouses.finding.<code>`). */
export const BW_FINDING_CODES = [
  'book_matches_physical',
  'physical_shortfall',
  'physical_surplus',
  'cgu_utilization_ok',
  'cgu_utilization_warning',
  'cgu_utilization_critical',
  'usual_handling_in_progress',
  'usual_handling_open_too_long',
  'partner_secure',
  'partner_without_aeo',
  'seal_not_verified',
  'increase_guarantee_or_discharge_stock',
  'close_usual_handling',
] as const;

/** Translation key of a finding written by the system, null for a free text typed by an operator. */
export function findingKey(text: string | null | undefined): string | null {
  return text !== null &&
    text !== undefined &&
    (BW_FINDING_CODES as readonly string[]).includes(text)
    ? `bondedWarehouses.finding.${text}`
    : null;
}
