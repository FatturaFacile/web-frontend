import { HttpErrorResponse } from '@angular/common/http';
import {
  ExmCalculationSource,
  ExmCardImportRow,
  ExmDecimal,
  ExmJurisdiction,
  ExmProblem,
  ExmReconciliationStatus,
  ExmReport,
  ExmReportStatus,
  ExmSeverity,
  ExmViolation,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): every member files their own reports. */
export const EXPENSE_MANAGEMENT_MODULE = 'expense_management';

/** Module key of the finance ability: the corporate card reconciliation. */
export const EXPENSE_MANAGEMENT_FINANCE_MODULE = 'expense_management_finance';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface ExmOutcome {
  ok: boolean;
  /** Translation key of the refusal (`expenseManagement.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  errors: Record<string, string[]>;
}

export const EXM_OK: ExmOutcome = { ok: true, errorKey: null, detail: null, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `expenseManagement.error.${code ? code : 'generic'}`;
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** The problem details of a failed call; a failed download answers a Blob that holds the JSON. */
export async function problemOf(error: unknown): Promise<ExmProblem | null> {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await readBlobText(body)) as ExmProblem;
    } catch {
      return null;
    }
  }
  return body !== null && typeof body === 'object' ? (body as ExmProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export async function failureOf(error: unknown): Promise<ExmOutcome> {
  const problem = await problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    detail: first ?? problem?.detail ?? null,
    errors,
  };
}

// --- Labels and colours ---

export function statusColor(status: ExmReportStatus): string {
  switch (status) {
    case 'submitted':
    case 'under_review':
      return 'gold';
    case 'approved':
      return 'cyan';
    case 'posted':
      return 'blue';
    case 'reimbursed':
      return 'green';
    case 'rejected':
      return 'red';
    case 'cancelled':
      return 'default';
    default:
      return 'geekblue';
  }
}

export function severityColor(severity: ExmSeverity): string {
  return severity === 'blocking' ? 'red' : 'orange';
}

export function reconciliationColor(status: ExmReconciliationStatus): string {
  switch (status) {
    case 'matched':
      return 'green';
    case 'disputed':
      return 'red';
    case 'ignored':
      return 'default';
    default:
      return 'gold';
  }
}

/** Translation key of a violation (`expenseManagement.violation.<code>`). */
export function violationKey(violation: Pick<ExmViolation, 'code'>): string {
  return `expenseManagement.violation.${violation.code}`;
}

// --- Workflow abilities ---

/** A report is edited (lines, mileage, per diem) while it is a draft or has been sent back. */
export function isEditable(report: Pick<ExmReport, 'status' | 'abilities'>): boolean {
  return report.abilities.update && (report.status === 'draft' || report.status === 'rejected');
}

export function canSubmit(report: Pick<ExmReport, 'status' | 'abilities'>): boolean {
  return report.abilities.submit && (report.status === 'draft' || report.status === 'rejected');
}

export function canDecide(report: Pick<ExmReport, 'status' | 'abilities'>): boolean {
  return (
    report.abilities.approve && (report.status === 'submitted' || report.status === 'under_review')
  );
}

/** An approver takes a submitted report into review before deciding. */
export function canStartReview(report: Pick<ExmReport, 'status' | 'abilities'>): boolean {
  return report.abilities.approve && report.status === 'submitted';
}

export function canExport(report: Pick<ExmReport, 'status' | 'abilities'>): boolean {
  return report.abilities.settle && report.status === 'approved';
}

export function canConfirmReimbursement(report: Pick<ExmReport, 'status' | 'abilities'>): boolean {
  return report.abilities.settle && report.status === 'posted';
}

export function canCancel(report: Pick<ExmReport, 'status' | 'abilities'>): boolean {
  return (
    report.abilities.update &&
    (report.status === 'draft' || report.status === 'submitted' || report.status === 'rejected')
  );
}

// --- Fiscal notices ---

/** The fiscal notices (`expenseManagement.fiscal.<code>`) that apply to a jurisdiction. */
export function fiscalNotices(jurisdiction: ExmJurisdiction): string[] {
  return jurisdiction === 'IT'
    ? ['it_art51_tuir', 'it_traceable_payment', 'it_per_diem_limits', 'it_aci_tables']
    : ['ch_spesenreglement', 'ch_tcs_mileage'];
}

/** The mileage rate source a jurisdiction uses unless the user picks another. */
export function defaultCalculationSource(jurisdiction: ExmJurisdiction): ExmCalculationSource {
  return jurisdiction === 'IT' ? 'IT_ACI_TABLE' : 'CH_TCS';
}

// --- Numbers and files ---

export function toNumber(value: ExmDecimal | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** True when a decimal is greater than zero. */
export function isPositive(value: ExmDecimal | null | undefined): boolean {
  return toNumber(value) > 0;
}

/** The highest severity among violations, null when there is none. */
export function worstSeverity(violations: readonly ExmViolation[]): ExmSeverity | null {
  if (violations.some((violation) => violation.severity === 'blocking')) {
    return 'blocking';
  }
  return violations.length > 0 ? 'warning' : null;
}

/** Saves a downloaded blob through a temporary link. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Today as `YYYY-MM-DD`. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** First and last day of the current month, as `YYYY-MM-DD`. */
export function currentMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// --- Card statement import ---

const CARD_CSV_COLUMNS = [
  'external_id',
  'merchant_name',
  'transaction_date',
  'posting_date',
  'amount',
  'currency',
] as const;

/**
 * Reads the lines of a card statement from CSV text. The first line is the header with the column names
 * (`external_id`, `merchant_name`, `transaction_date`, `posting_date`, `amount`, `currency`); the separator is a comma
 * or a semicolon. Rows without a merchant, a date or an amount are skipped.
 */
export function parseCardCsv(text: string): ExmCardImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length < 2) {
    return [];
  }
  const separator = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(separator).map((name) => name.trim().toLowerCase());
  const rows: ExmCardImportRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    for (const column of CARD_CSV_COLUMNS) {
      const index = header.indexOf(column);
      row[column] = index >= 0 ? (cells[index] ?? '') : '';
    }
    const amount = row['amount'].replace(',', '.');
    if (
      !row['merchant_name'] ||
      !row['transaction_date'] ||
      !Number.isFinite(Number(amount)) ||
      amount === ''
    ) {
      continue;
    }
    rows.push({
      external_id: row['external_id'] || null,
      merchant_name: row['merchant_name'],
      transaction_date: row['transaction_date'],
      posting_date: row['posting_date'] || null,
      amount,
      currency: row['currency'] || null,
    });
  }

  return rows;
}
