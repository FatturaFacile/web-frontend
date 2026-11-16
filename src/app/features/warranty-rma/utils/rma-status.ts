import { HttpErrorResponse } from '@angular/common/http';
import {
  DdtCausale,
  EsmErrorBody,
  EstimateApprovalStatus,
  Loaner,
  LoanerStatus,
  RmaOrder,
  WarrantyRmaStatus,
  VendorClaimStatus,
  WarrantyStatus,
} from '@core';

/** Visual hint for a status: tag colour plus an icon, always rendered next to a text label. */
export interface StatusTag {
  color: string;
  icon: string;
  labelKey: string;
}

export const DDT_CAUSALI: readonly DdtCausale[] = [
  'conto_riparazione',
  'prestito_uso',
  'reso_riparato',
  'sostituzione_garanzia',
];

/** Kanban column order. `closed` is only shown with the "include closed" toggle. */
export const RMA_BOARD_STATUSES: readonly WarrantyRmaStatus[] = [
  'awaiting_arrival',
  'in_diagnosis',
  'awaiting_estimate_approval',
  'awaiting_parts',
  'in_repair_testing',
  'ready_for_return',
  'returned',
  'closed',
];

const KNOWN_RMA_STATUSES: readonly string[] = [...RMA_BOARD_STATUSES, 'cancelled'];

export type RmaAction =
  | 'receive'
  | 'diagnosis'
  | 'approve_estimate'
  | 'decline_estimate'
  | 'resend_estimate'
  | 'parts_received'
  | 'complete_repair'
  | 'return'
  | 'close'
  | 'cancel';

/** UI hint of the backend state machine; the backend stays authoritative (409 `invalid_transition`). */
const RMA_ACTIONS: Readonly<Record<WarrantyRmaStatus, readonly RmaAction[]>> = {
  awaiting_arrival: ['receive', 'cancel'],
  in_diagnosis: ['diagnosis', 'cancel'],
  awaiting_estimate_approval: ['approve_estimate', 'decline_estimate', 'resend_estimate'],
  awaiting_parts: ['parts_received'],
  in_repair_testing: ['complete_repair'],
  ready_for_return: ['return'],
  returned: ['close'],
  closed: [],
  cancelled: [],
};

/** Actions offered for a status; unknown (future) statuses get none. */
export function allowedRmaActions(status: string): readonly RmaAction[] {
  return RMA_ACTIONS[status as WarrantyRmaStatus] ?? [];
}

/** A loaner can be issued while the customer unit is in the depot and none is out already. */
export function canIssueLoaner(rma: Pick<RmaOrder, 'status' | 'loaner'>): boolean {
  const open: readonly string[] = [
    'awaiting_arrival',
    'in_diagnosis',
    'awaiting_estimate_approval',
    'awaiting_parts',
    'in_repair_testing',
  ];
  return open.includes(rma.status) && (!rma.loaner || rma.loaner.status !== 'issued');
}

export function rmaStatusLabelKey(status: string): string {
  return KNOWN_RMA_STATUSES.includes(status) ? `RMA.STATUS.${status.toUpperCase()}` : status;
}

export function rmaStatusTag(status: string): StatusTag {
  const map: Record<string, Omit<StatusTag, 'labelKey'>> = {
    awaiting_arrival: { color: 'default', icon: 'fa-solid fa-truck' },
    in_diagnosis: { color: 'processing', icon: 'fa-solid fa-stethoscope' },
    awaiting_estimate_approval: { color: 'warning', icon: 'fa-solid fa-file-signature' },
    awaiting_parts: { color: 'orange', icon: 'fa-solid fa-boxes-packing' },
    in_repair_testing: { color: 'blue', icon: 'fa-solid fa-screwdriver-wrench' },
    ready_for_return: { color: 'cyan', icon: 'fa-solid fa-box' },
    returned: { color: 'success', icon: 'fa-solid fa-house-circle-check' },
    closed: { color: 'default', icon: 'fa-solid fa-lock' },
    cancelled: { color: 'error', icon: 'fa-solid fa-ban' },
  };
  return {
    ...(map[status] ?? { color: 'default', icon: 'fa-solid fa-circle-question' }),
    labelKey: rmaStatusLabelKey(status),
  };
}

export function warrantyStatusTag(status: WarrantyStatus | string): StatusTag {
  const map: Record<string, Omit<StatusTag, 'labelKey'>> = {
    covered_in_warranty: { color: 'success', icon: 'fa-solid fa-shield-halved' },
    out_of_warranty_billable: { color: 'warning', icon: 'fa-solid fa-coins' },
    goodwill: { color: 'purple', icon: 'fa-solid fa-hand-holding-heart' },
  };
  return {
    ...(map[status] ?? { color: 'default', icon: 'fa-solid fa-circle-question' }),
    labelKey: map[status] ? `RMA.WARRANTY_STATUS.${status.toUpperCase()}` : status,
  };
}

/** Lookup result: in / out of warranty. */
export function warrantyEvaluationTag(
  status: 'in_warranty' | 'out_of_warranty' | string,
): StatusTag {
  return status === 'in_warranty'
    ? { color: 'success', icon: 'fa-solid fa-shield-halved', labelKey: 'RMA.LOOKUP.IN_WARRANTY' }
    : { color: 'error', icon: 'fa-solid fa-shield', labelKey: 'RMA.LOOKUP.OUT_OF_WARRANTY' };
}

export function estimateApprovalTag(
  status: EstimateApprovalStatus | string | null,
): StatusTag | null {
  if (!status) {
    return null;
  }
  const map: Record<string, Omit<StatusTag, 'labelKey'>> = {
    not_required: { color: 'default', icon: 'fa-solid fa-minus' },
    auto_approved_under_threshold: { color: 'success', icon: 'fa-solid fa-bolt' },
    pending_customer_approval: { color: 'warning', icon: 'fa-solid fa-hourglass-half' },
    approved: { color: 'success', icon: 'fa-solid fa-check' },
    declined_return_unrepaired: { color: 'error', icon: 'fa-solid fa-xmark' },
  };
  return {
    ...(map[status] ?? { color: 'default', icon: 'fa-solid fa-circle-question' }),
    labelKey: map[status] ? `RMA.ESTIMATE_STATUS.${status.toUpperCase()}` : status,
  };
}

export const VENDOR_CLAIM_STATUSES: readonly VendorClaimStatus[] = [
  'draft',
  'submitted',
  'acknowledged',
  'approved_credit_note',
  'approved_replacement',
  'rejected',
  'closed',
];

const VENDOR_CLAIM_TRANSITIONS: Readonly<Record<VendorClaimStatus, readonly VendorClaimStatus[]>> =
  {
    draft: ['submitted'],
    submitted: ['acknowledged'],
    acknowledged: ['approved_credit_note', 'approved_replacement', 'rejected'],
    approved_credit_note: ['closed'],
    approved_replacement: ['closed'],
    rejected: ['closed'],
    closed: [],
  };

export function nextVendorClaimStatuses(status: string): readonly VendorClaimStatus[] {
  return VENDOR_CLAIM_TRANSITIONS[status as VendorClaimStatus] ?? [];
}

/** Moving a claim to `approved_credit_note` requires the supplier credit note reference. */
export function requiresCreditNoteReference(to: VendorClaimStatus | null | undefined): boolean {
  return to === 'approved_credit_note';
}

export function vendorClaimTag(status: VendorClaimStatus | string): StatusTag {
  const map: Record<string, Omit<StatusTag, 'labelKey'>> = {
    draft: { color: 'default', icon: 'fa-solid fa-pen' },
    submitted: { color: 'processing', icon: 'fa-solid fa-paper-plane' },
    acknowledged: { color: 'blue', icon: 'fa-solid fa-envelope-open' },
    approved_credit_note: { color: 'success', icon: 'fa-solid fa-file-invoice' },
    approved_replacement: { color: 'success', icon: 'fa-solid fa-right-left' },
    rejected: { color: 'error', icon: 'fa-solid fa-xmark' },
    closed: { color: 'default', icon: 'fa-solid fa-lock' },
  };
  return {
    ...(map[status] ?? { color: 'default', icon: 'fa-solid fa-circle-question' }),
    labelKey: map[status] ? `RMA.CLAIM_STATUS.${status.toUpperCase()}` : status,
  };
}

export function loanerStatusTag(status: LoanerStatus | string): StatusTag {
  const map: Record<string, Omit<StatusTag, 'labelKey'>> = {
    issued: { color: 'processing', icon: 'fa-solid fa-arrow-right-from-bracket' },
    returned: { color: 'success', icon: 'fa-solid fa-arrow-right-to-bracket' },
    lost: { color: 'error', icon: 'fa-solid fa-circle-exclamation' },
  };
  return {
    ...(map[status] ?? { color: 'default', icon: 'fa-solid fa-circle-question' }),
    labelKey: map[status] ? `RMA.LOANER_STATUS.${status.toUpperCase()}` : status,
  };
}

/** Overdue only while the loaner is still out with the customer. */
export function isLoanerOverdue(
  loaner: Pick<Loaner, 'status' | 'is_overdue'> | null | undefined,
): boolean {
  return !!loaner && loaner.status === 'issued' && loaner.is_overdue;
}

/** `code` of an ESM error response (`invalid_transition`, `serial_not_found`, ...). */
export function esmErrorCode(err: unknown): string | null {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
    const code = (err.error as EsmErrorBody).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function esmErrorBody(err: unknown): EsmErrorBody | null {
  return err instanceof HttpErrorResponse && err.error && typeof err.error === 'object'
    ? (err.error as EsmErrorBody)
    : null;
}

export function httpStatus(err: unknown): number | null {
  return err instanceof HttpErrorResponse ? err.status : null;
}

/** Decimal strings from the API as numbers for the currency pipe. */
export function toAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
