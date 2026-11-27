import { HttpErrorResponse } from '@angular/common/http';
import {
  FVR_COUNTRIES,
  FvrClaim,
  FvrClaimStatus,
  FvrEligibility,
  FvrLedgerStatus,
  FvrMandateStatus,
  FvrProblem,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance roles write, purchasing and operations managers read. */
export const FOREIGN_VAT_MODULE = 'foreign_vat_refund';

/** What a store write answers: the screens show the translated error. */
export interface FvrOutcome {
  ok: boolean;
  /** Translation key of the refusal (`foreignVat.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  /** Values the API reports with the refusal (deadline, threshold, country...): the placeholders of the text. */
  params: Record<string, string>;
}

export const FVR_OK: FvrOutcome = { ok: true, errorKey: null, code: null, params: {} };

export function errorKey(code: string | null | undefined): string {
  return `foreignVat.error.${code ? code : 'unknown'}`;
}

export function problemOf(error: unknown): FvrProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as FvrProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, its context fills the placeholders. */
export function failureOf(error: unknown): FvrOutcome {
  const problem = problemOf(error);
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(problem?.context ?? {})) {
    params[key] = value === null || value === undefined ? '' : String(value);
  }
  return { ok: false, errorKey: errorKey(problem?.code), code: problem?.code ?? null, params };
}

/** NG-ZORRO tag colour of a claim status. */
export function claimStatusColor(status: FvrClaimStatus | null | undefined): string {
  switch (status) {
    case 'REFUNDED':
    case 'APPROVED':
      return 'green';
    case 'REJECTED':
      return 'red';
    case 'PARTIALLY_APPROVED':
    case 'ADDITIONAL_INFO_REQUESTED':
      return 'orange';
    case 'SUBMITTED':
      return 'blue';
    case 'READY_TO_SUBMIT':
      return 'gold';
    default:
      return 'default';
  }
}

/** NG-ZORRO tag colour of a ledger line status. */
export function ledgerStatusColor(status: FvrLedgerStatus | null | undefined): string {
  switch (status) {
    case 'REFUNDED':
      return 'green';
    case 'ELIGIBLE_ACCUMULATING':
      return 'cyan';
    case 'INCLUDED_IN_CLAIM':
      return 'blue';
    case 'PARTIALLY_REJECTED':
      return 'orange';
    case 'NON_RECOVERABLE_EXPENSED':
      return 'red';
    default:
      return 'default';
  }
}

/** Colour of the countdown badge: red when the deadline is near or missed, orange within 60 days. */
export function alertColor(level: number | 'EXPIRED' | null | undefined): string {
  if (level === 'EXPIRED' || level === 15) {
    return 'red';
  }
  if (level === 30) {
    return 'volcano';
  }
  return level === 60 ? 'orange' : 'default';
}

export function eligibilityColor(status: FvrEligibility | null | undefined): string {
  return status === 'THRESHOLD_MET' ? 'green' : 'default';
}

export function mandateColor(status: FvrMandateStatus | null | undefined): string {
  switch (status) {
    case 'VALID':
      return 'green';
    case 'NOT_REQUIRED':
      return 'default';
    case 'CERTIFICATE_EXPIRING':
      return 'orange';
    default:
      return 'red';
  }
}

/** Progress bar status: success once the threshold is met, the active animation otherwise. */
export function progressStatus(eligibility: FvrEligibility): 'success' | 'active' {
  return eligibility === 'THRESHOLD_MET' ? 'success' : 'active';
}

/** Index of the current step of the `nz-steps` timeline of a claim. */
export function stepIndex(status: FvrClaimStatus): number {
  switch (status) {
    case 'DRAFT':
      return 0;
    case 'READY_TO_SUBMIT':
      return 1;
    case 'SUBMITTED':
    case 'ADDITIONAL_INFO_REQUESTED':
      return 2;
    case 'APPROVED':
    case 'PARTIALLY_APPROVED':
    case 'REJECTED':
      return 3;
    default:
      return 4;
  }
}

/** The official file a claim of a regime can export. */
export function exportTypesOf(claim: Pick<FvrClaim, 'regime_type'>): ('eu-xml' | 'estv-package' | 'iva79-package')[] {
  switch (claim.regime_type) {
    case 'EU_DIR_2008_9_CE':
      return ['eu-xml'];
    case 'CH_ESTV_RECIPROCITY':
      return ['estv-package'];
    case 'IT_ART_38_TER':
      return ['iva79-package'];
    default:
      return [];
  }
}

/** `YYYY-MM-DD` of a picked date, the format the API takes. */
export function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Saves a downloaded file through a temporary link. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** File name of an export (the extension follows the type). */
export function exportFilename(claimNumber: string, type: 'eu-xml' | 'estv-package' | 'iva79-package'): string {
  return type === 'eu-xml' ? `${claimNumber}-eu-portal.xml` : `${claimNumber}-${type === 'estv-package' ? 'estv' : 'iva79'}.zip`;
}

/**
 * The country a VAT identification number belongs to, from its prefix (CHE-123.456.789 MWST, DE123456789, EL123456789); null without a
 * recognisable prefix. The same reading as the interception of the API, so the badge of a form agrees with what the ledger will record.
 */
export function countryOfVatNumber(value: string | null | undefined): string | null {
  const compact = (value ?? '').replace(/[\s.-]/g, '').toUpperCase();
  if (compact.startsWith('CHE')) {
    return 'CH';
  }
  const prefix = compact.slice(0, 2);
  if (prefix === 'EL') {
    return 'GR';
  }
  if (prefix === 'XI') {
    return 'GB';
  }
  return /^[A-Z]{2}[A-Z0-9]{2,}$/.test(compact) && (FVR_COUNTRIES as readonly string[]).includes(prefix)
    ? prefix
    : null;
}

/** Amount as a number for the NG-ZORRO inputs (the API sends decimal strings). */
export function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined || value === '' ? 0 : Number(value);
}
