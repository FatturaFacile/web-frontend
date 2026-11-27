import { HttpErrorResponse } from '@angular/common/http';
import {
  EbillChannelType,
  EbillParticipantStatus,
  EbillProblem,
  EbillTransmissionStatus,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance and sales roles. */
export const SWISS_EBILL_MODULE = 'swiss_ebill';

/** What a store write answers: the screens show the translated error and, for a refused send, the pre-flight violations. */
export interface EbillOutcome {
  ok: boolean;
  /** Translation key of the refusal (`swissEbill.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  detail: string | null;
  violations: { code: string; field: string }[];
}

export const EBILL_OK: EbillOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  violations: [],
};

export function errorKey(code: string | null | undefined): string {
  return `swissEbill.error.${code ? code : 'unknown'}`;
}

export function problemOf(error: unknown): EbillProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as EbillProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a refused pre-flight brings its violations. */
export function failureOf(error: unknown): EbillOutcome {
  const problem = problemOf(error);
  const first = Object.values(problem?.errors ?? {}).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    code: problem?.code ?? null,
    detail: first ?? problem?.detail ?? null,
    violations: problem?.violations ?? [],
  };
}

/** NG-ZORRO tag colour of a transmission status. */
export function statusColor(status: EbillTransmissionStatus | null | undefined): string {
  switch (status) {
    case 'approved_by_debtor':
    case 'paid_reconciled':
      return 'green';
    case 'rejected_by_debtor':
    case 'failed_technical':
      return 'red';
    case 'transmitted':
    case 'delivered_to_ebanking':
      return 'blue';
    case 'queued':
      return 'gold';
    default:
      return 'default';
  }
}

/** Key suffix of the badge shown next to a customer (`swissEbill.badge.<key>`), from its enrollment and channel. */
export function badgeKey(
  status: EbillParticipantStatus | null | undefined,
  channel: EbillChannelType | null | undefined,
): string {
  switch (status) {
    case 'enrolled':
      return channel === 'b2b_enterprise' ? 'active_b2b' : 'active_b2c';
    case 'not_enrolled':
      return 'not_enrolled';
    case 'pending_opt_in':
      return 'pending_opt_in';
    case 'suspended':
      return 'suspended';
    default:
      return 'not_verified';
  }
}

export function badgeColor(status: EbillParticipantStatus | null | undefined): string {
  switch (status) {
    case 'enrolled':
      return 'green';
    case 'pending_opt_in':
      return 'gold';
    case 'suspended':
      return 'red';
    default:
      return 'default';
  }
}

/** Timeline dot colour of a lifecycle event, by the status it moved to. */
export function timelineColor(status: EbillTransmissionStatus | null | undefined): string {
  switch (status) {
    case 'approved_by_debtor':
    case 'paid_reconciled':
      return 'green';
    case 'rejected_by_debtor':
    case 'failed_technical':
      return 'red';
    case 'cancelled':
      return 'gray';
    default:
      return 'blue';
  }
}

/** Saves a downloaded payload through a temporary link. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** `1.5 MB`-style size of the embedded courtesy PDF. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
