import { HttpErrorResponse } from '@angular/common/http';
import {
  AnnualVat,
  CuCertification,
  F24Payment,
  LipeCommunication,
  PlafondAlert,
  PlafondRow,
  PlafondStatus,
  VentilationBasisLine,
} from '@core';

/** Decimal string to integer cents, so sums and comparisons never suffer float drift. */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export interface ProblemIssue {
  code: string;
  params: Record<string, string | number>;
}

/** The stable rule code (and its parameters) of an RFC 7807 problem of the Italian VAT module, or `null` for any other error. */
export function problemIssue(error: unknown): ProblemIssue | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const issue = (error.error as { invalid_params?: { code?: unknown; params?: unknown }[] } | null)
    ?.invalid_params?.[0];
  if (!issue || typeof issue.code !== 'string') {
    return null;
  }
  return { code: issue.code, params: (issue.params ?? {}) as Record<string, string | number> };
}

/** Translation key of a rule violation (`italianVat.error.<code>`). */
export function problemKey(issue: ProblemIssue): string {
  return `italianVat.error.${issue.code}`;
}

// --- Plafond ---

export const PLAFOND_STATUS_COLORS: Readonly<Record<PlafondStatus, string>> = {
  active: 'green',
  exhausted: 'orange',
  expired: 'default',
  revoked: 'red',
  not_yet_valid: 'blue',
};

export const PLAFOND_ALERT_COLORS: Readonly<Record<PlafondAlert, string>> = {
  ok: 'green',
  warning: 'orange',
  critical: 'red',
};

/** Share of the plafond already used, 0-100 (capped), for the progress bar. */
export function plafondUsage(row: Pick<PlafondRow, 'usage_percentage'>): number {
  const value = Number(row.usage_percentage);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

/** Whether the declaration still allows invoicing without VAT: active, within its dates and not exhausted. */
export function plafondUsable(row: Pick<PlafondRow, 'status'>): boolean {
  return row.status === 'active';
}

/** Letters of intent that block invoicing without VAT today (Art. 8 c. 1 lett. c DPR 633/1972). */
export function blockedDeclarations(rows: readonly PlafondRow[]): PlafondRow[] {
  return rows.filter((row) => !plafondUsable(row));
}

/** Declarations the user can still revoke. */
export function plafondRevocable(row: Pick<PlafondRow, 'status'>): boolean {
  return row.status === 'active' || row.status === 'not_yet_valid';
}

/** Protocol of the Agenzia delle Entrate receipt of a declaration: 17 digits, optionally "-" or "/" and 6 digits. */
export const INTENT_PROTOCOL_PATTERN = /^\d{17}([-/]\d{6})?$/;

export type DeclarationIssue =
  'protocol_format' | 'dates_order' | 'protocol_after_validity' | 'plafond_not_positive';

export interface DeclarationDraft {
  protocol_number: string;
  receipt_date: string;
  valid_from: string;
  valid_to: string;
  plafond_amount: number;
}

/** Form-level checks of a declaration of intent before it is sent to the backend. */
export function validateDeclaration(draft: DeclarationDraft): DeclarationIssue[] {
  const issues: DeclarationIssue[] = [];
  if (!INTENT_PROTOCOL_PATTERN.test(draft.protocol_number)) {
    issues.push('protocol_format');
  }
  if (draft.valid_from && draft.valid_to && draft.valid_to < draft.valid_from) {
    issues.push('dates_order');
  }
  if (draft.receipt_date && draft.valid_to && draft.receipt_date > draft.valid_to) {
    issues.push('protocol_after_validity');
  }
  if (!(draft.plafond_amount > 0)) {
    issues.push('plafond_not_positive');
  }
  return issues;
}

// --- Ventilation of the daily takings ---

export function basisTotal(basis: readonly VentilationBasisLine[]): string {
  return fromCents(basis.reduce((sum, line) => sum + toCents(line.amount), 0));
}

/** A ventilation needs positive takings and at least one purchase base with a rate and a non-zero total. */
export function ventilationIssues(
  grossTakings: string,
  basis: readonly VentilationBasisLine[],
): ('gross' | 'basis' | 'nature')[] {
  const issues: ('gross' | 'basis' | 'nature')[] = [];
  if (toCents(grossTakings) <= 0) {
    issues.push('gross');
  }
  if (basis.length === 0 || toCents(basisTotal(basis)) <= 0) {
    issues.push('basis');
  }
  if (basis.some((line) => Number(line.rate) === 0 && !line.nature)) {
    issues.push('nature');
  }
  return issues;
}

// --- LIPE ---

export interface LipeActions {
  reconcile: boolean;
  sign: boolean;
  markReady: boolean;
  transmit: boolean;
  reject: boolean;
  download: boolean;
}

/** The actions the status flow (draft, validated, signed, ready, transmitted, rejected) allows on a communication. */
export function lipeActions(lipe: LipeCommunication): LipeActions {
  const open = lipe.status !== 'transmitted';
  const xsdOk = lipe.xsd_errors.length === 0;
  return {
    reconcile: open,
    sign: (lipe.status === 'validated' || lipe.status === 'signed') && xsdOk,
    markReady:
      lipe.status === 'signed' &&
      lipe.signature_status === 'signed' &&
      lipe.reconciliation_status === 'balanced',
    transmit: lipe.status === 'ready',
    reject: lipe.status === 'ready' || lipe.status === 'transmitted',
    download: xsdOk,
  };
}

export const LIPE_STATUS_COLORS: Readonly<Record<LipeCommunication['status'], string>> = {
  draft: 'default',
  validated: 'blue',
  signed: 'cyan',
  ready: 'geekblue',
  transmitted: 'green',
  rejected: 'red',
};

/** Protocol of the transmission receipt: 17 digits, optionally followed by "-" or "/" and 6 digits. */
export function validTransmissionProtocol(protocol: string): boolean {
  return INTENT_PROTOCOL_PATTERN.test(protocol.trim());
}

// --- Annual VAT ---

/** Annual VAT can only be finalised once the ledger agrees with the settlements. */
export function annualCanFinalize(
  annual: Pick<AnnualVat, 'is_reconciled' | 'finalized_at'> | null,
): boolean {
  return annual !== null && annual.is_reconciled && annual.finalized_at === null;
}

export function diagnosticKey(code: string): string {
  return `italianVat.diagnostic.${code}`;
}

/** Net position of the year: a positive value is VAT to pay, a negative one a credit. */
export function annualNetPosition(
  annual: Pick<AnnualVat, 'annual_debit' | 'annual_credit'>,
): string {
  return fromCents(toCents(annual.annual_debit) - toCents(annual.annual_credit));
}

// --- Certificazione Unica and F24 ---

export const CU_STATUS_COLORS: Readonly<Record<CuCertification['status'], string>> = {
  draft: 'default',
  validated: 'blue',
  issued: 'green',
};

/** The CU can be issued once every certification is validated; already issued ones are left alone. */
export function cuCanIssue(certifications: readonly CuCertification[]): boolean {
  const pending = certifications.filter((cu) => cu.status !== 'issued');
  return pending.length > 0 && pending.every((cu) => cu.status === 'validated');
}

export function cuInvalid(certifications: readonly CuCertification[]): CuCertification[] {
  return certifications.filter((cu) => (cu.validation_errors?.length ?? 0) > 0);
}

export const F24_STATUS_COLORS: Readonly<Record<F24Payment['status'], string>> = {
  due: 'red',
  partial: 'orange',
  paid: 'green',
  overpaid: 'purple',
};

export function f24Outstanding(payment: Pick<F24Payment, 'amount_due' | 'amount_paid'>): string {
  return fromCents(Math.max(0, toCents(payment.amount_due) - toCents(payment.amount_paid)));
}

/** Payments that still need money. */
export function f24Unpaid(payments: readonly F24Payment[]): F24Payment[] {
  return payments.filter((payment) => toCents(f24Outstanding(payment)) > 0);
}
