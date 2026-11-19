import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import type {
  PgBreachJurisdiction,
  PgConsentEntry,
  PgCrossBorderTransfer,
  PgDsar,
  PgDsarStatus,
  PgErasurePreview,
} from '@core';

/** GDPR Art. 12(3) / nLPD Art. 25(7): a data subject request is answered within 30 days. */
export const DSAR_TOTAL_DAYS = 30;

/** A request with fewer days left than this is highlighted as urgent. */
export const DSAR_URGENT_DAYS = 5;

const DAY_MS = 86_400_000;

const CLOSED_DSAR_STATUSES: readonly PgDsarStatus[] = [
  'completed',
  'partially_refused_fiscal_retention',
  'rejected',
];

/** The members of the European Economic Area (adequate for a CH controller under the nLPD ordinance annex 1). */
const EEA_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
]);

export function isDsarClosed(status: PgDsarStatus): boolean {
  return CLOSED_DSAR_STATUSES.includes(status);
}

/** Whole days left until the statutory deadline (rounded up); negative when overdue. */
export function dsarDaysLeft(deadlineIso: string, now: Date | number = Date.now()): number {
  const diff = new Date(deadlineIso).getTime() - (typeof now === 'number' ? now : now.getTime());
  return Math.ceil(diff / DAY_MS);
}

/** Days left of an open request, `null` once it is closed. The server figure wins when present. */
export function dsarCountdown(
  dsar: Pick<PgDsar, 'status' | 'statutory_deadline_at' | 'days_remaining'>,
  now: Date | number = Date.now(),
): number | null {
  if (isDsarClosed(dsar.status)) {
    return null;
  }
  return dsar.days_remaining ?? dsarDaysLeft(dsar.statutory_deadline_at, now);
}

/** Share of the response window already used (0 to 100), the value of the progress bar. */
export function dsarElapsedPercent(
  receivedIso: string,
  deadlineIso: string,
  now: Date | number = Date.now(),
): number {
  const start = new Date(receivedIso).getTime();
  const end = new Date(deadlineIso).getTime();
  const current = typeof now === 'number' ? now : now.getTime();
  const total = end - start;
  if (!Number.isFinite(total) || total <= 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.round(((current - start) / total) * 100)));
}

export function dsarIsUrgent(daysLeft: number | null): boolean {
  return daysLeft !== null && daysLeft < DSAR_URGENT_DAYS;
}

export type DsarProgressStatus = 'success' | 'normal' | 'exception' | 'active';

/** Colour of the countdown bar: red when urgent or overdue, green once closed. */
export function dsarProgressStatus(daysLeft: number | null): DsarProgressStatus {
  if (daysLeft === null) {
    return 'success';
  }
  return dsarIsUrgent(daysLeft) ? 'exception' : 'active';
}

/** `HH:MM:SS` of a number of seconds (never negative; hours may exceed 24). */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/** Seconds from now to a deadline (negative once passed). */
export function secondsUntil(deadlineIso: string, now: number = Date.now()): number {
  return Math.floor((new Date(deadlineIso).getTime() - now) / 1000);
}

export interface BreachCountdown {
  /** Seconds left to the deadline, negative once overdue. */
  readonly seconds: Signal<number>;
  /** `HH:MM:SS` of the remaining time (zero once overdue). */
  readonly label: Signal<string>;
  readonly overdue: Signal<boolean>;
}

/**
 * A ticking countdown to the 72 hours deadline of a breach. The clock signal is updated every second by an interval that
 * is cleared when the injection context is destroyed. Call it in an injection context.
 */
export function createBreachCountdown(
  deadline: Signal<string | null | undefined>,
  tickMs = 1000,
): BreachCountdown {
  const now = signal(Date.now());
  const timer = setInterval(() => now.set(Date.now()), tickMs);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));

  const seconds = computed(() => {
    const value = deadline();
    return value ? secondsUntil(value, now()) : 0;
  });
  return {
    seconds,
    label: computed(() => formatCountdown(seconds())),
    overdue: computed(() => !!deadline() && seconds() < 0),
  };
}

/** Share of the consent ledger that grants consent (0 to 100, one decimal), `null` for an empty ledger. */
export function consentOptInRate(
  entries: readonly Pick<PgConsentEntry, 'consent_granted'>[],
): number | null {
  if (entries.length === 0) {
    return null;
  }
  const granted = entries.filter((entry) => entry.consent_granted).length;
  return Math.round((granted / entries.length) * 1000) / 10;
}

export type CrossBorderKind = 'ch' | 'eu' | 'third';

export function crossBorderKind(countryCode: string): CrossBorderKind {
  const code = countryCode.trim().toUpperCase();
  if (code === 'CH') {
    return 'ch';
  }
  return EEA_COUNTRIES.has(code) ? 'eu' : 'third';
}

/** The distinct kinds of destination of the transfers of an activity, the riskiest last. */
export function crossBorderKinds(transfers: readonly PgCrossBorderTransfer[]): CrossBorderKind[] {
  const kinds = new Set(transfers.map((transfer) => crossBorderKind(transfer.country_code)));
  return (['ch', 'eu', 'third'] as const).filter((kind) => kinds.has(kind));
}

/** Retention as `{ years, months }` parts of a number of months. */
export function retentionParts(months: number | null): { years: number; months: number } | null {
  if (months === null || months === undefined) {
    return null;
  }
  return { years: Math.floor(months / 12), months: months % 12 };
}

export type BreachField =
  | 'description'
  | 'affected_subjects_count'
  | 'affected_data_categories'
  | 'containment_measures'
  | 'remediation_plan';

/**
 * Fields the notification needs for the authority: Art. 33(3) GDPR asks for the number of subjects and the remediation
 * measures; Art. 24 nLPD asks for the nature, the consequences and the measures, the number is given when possible.
 */
export function breachRequiredFields(jurisdiction: PgBreachJurisdiction): BreachField[] {
  const nlpd: BreachField[] = ['description', 'affected_data_categories', 'containment_measures'];
  const gdpr: BreachField[] = [
    'description',
    'affected_subjects_count',
    'affected_data_categories',
    'containment_measures',
    'remediation_plan',
  ];
  switch (jurisdiction) {
    case 'ch_nlpd_fdpic':
      return nlpd;
    case 'it_gdpr_garante':
      return gdpr;
    default:
      return gdpr;
  }
}

export function erasureRowCount(rows: readonly { rows: number }[]): number {
  return rows.reduce((sum, row) => sum + row.rows, 0);
}

export interface ErasureSummary {
  anonymizeTables: number;
  anonymizeRows: number;
  protectedTables: number;
  protectedRows: number;
  locked: boolean;
}

export function summarizeErasure(preview: PgErasurePreview): ErasureSummary {
  return {
    anonymizeTables: preview.to_anonymize.length,
    anonymizeRows: erasureRowCount(preview.to_anonymize),
    protectedTables: preview.protected.length,
    protectedRows: erasureRowCount(preview.protected),
    locked: preview.fiscal_lock.is_locked,
  };
}

/** Splits free text typed in a tag input into distinct trimmed values. */
export function uniqueTags(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value !== ''))];
}

export type PgTagColor =
  'default' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gold' | 'cyan';

export function dsarStatusColor(status: PgDsarStatus): PgTagColor {
  switch (status) {
    case 'completed':
      return 'green';
    case 'identity_verified':
      return 'blue';
    case 'in_progress':
      return 'cyan';
    case 'partially_refused_fiscal_retention':
      return 'orange';
    case 'rejected':
      return 'red';
    default:
      return 'gold';
  }
}

export function severityColor(severity: string): PgTagColor {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'high':
      return 'orange';
    case 'medium':
      return 'gold';
    default:
      return 'green';
  }
}

export function legalBasisColor(basis: string): PgTagColor {
  switch (basis) {
    case 'consent':
      return 'purple';
    case 'contract':
      return 'blue';
    case 'legal_obligation':
      return 'green';
    case 'legitimate_interest':
      return 'orange';
    default:
      return 'cyan';
  }
}

/** The message of a failed request: the `message` of the API (422 business errors) or the given fallback. */
export function pgErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string' &&
      body.message !== ''
    ) {
      return body.message;
    }
  }
  return fallback;
}
