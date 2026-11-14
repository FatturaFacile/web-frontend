import {
  SupplierBankChangeStatus,
  SupplierCheckResult,
  SupplierCheckType,
  SupplierDocumentStatus,
  SupplierOnboardingStatus,
  SupplierRiskLevel,
} from '@core';

/** Translation keys and tag colours of the values the supplier portal API returns. */
export const ONBOARDING_STATUS_LABELS: Readonly<Record<SupplierOnboardingStatus, string>> = {
  invited: 'SUPPLIER_PORTAL.STATUS_INVITED',
  registration_submitted: 'SUPPLIER_PORTAL.STATUS_REGISTRATION_SUBMITTED',
  documents_required: 'SUPPLIER_PORTAL.STATUS_DOCUMENTS_REQUIRED',
  under_review: 'SUPPLIER_PORTAL.STATUS_UNDER_REVIEW',
  approved: 'SUPPLIER_PORTAL.STATUS_APPROVED',
  rejected: 'SUPPLIER_PORTAL.STATUS_REJECTED',
  blocked: 'SUPPLIER_PORTAL.STATUS_BLOCKED',
};

export const ONBOARDING_STATUS_COLORS: Readonly<Record<SupplierOnboardingStatus, string>> = {
  invited: 'default',
  registration_submitted: 'blue',
  documents_required: 'orange',
  under_review: 'gold',
  approved: 'green',
  rejected: 'red',
  blocked: 'volcano',
};

export const DOCUMENT_STATUS_LABELS: Readonly<Record<SupplierDocumentStatus, string>> = {
  submitted: 'SUPPLIER_PORTAL.DOC_STATUS_SUBMITTED',
  accepted: 'SUPPLIER_PORTAL.DOC_STATUS_ACCEPTED',
  rejected: 'SUPPLIER_PORTAL.DOC_STATUS_REJECTED',
  superseded: 'SUPPLIER_PORTAL.DOC_STATUS_SUPERSEDED',
};

export const DOCUMENT_STATUS_COLORS: Readonly<Record<SupplierDocumentStatus, string>> = {
  submitted: 'blue',
  accepted: 'green',
  rejected: 'red',
  superseded: 'default',
};

export const RISK_LEVEL_LABELS: Readonly<Record<SupplierRiskLevel, string>> = {
  none: 'SUPPLIER_PORTAL.RISK_NONE',
  low: 'SUPPLIER_PORTAL.RISK_LOW',
  medium: 'SUPPLIER_PORTAL.RISK_MEDIUM',
  high: 'SUPPLIER_PORTAL.RISK_HIGH',
  critical: 'SUPPLIER_PORTAL.RISK_CRITICAL',
};

export const RISK_LEVEL_COLORS: Readonly<Record<SupplierRiskLevel, string>> = {
  none: 'green',
  low: 'lime',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

export const BANK_STATUS_LABELS: Readonly<Record<SupplierBankChangeStatus, string>> = {
  pending: 'SUPPLIER_PORTAL.BANK_STATUS_PENDING',
  applied: 'SUPPLIER_PORTAL.BANK_STATUS_APPLIED',
  rejected: 'SUPPLIER_PORTAL.BANK_STATUS_REJECTED',
  cancelled: 'SUPPLIER_PORTAL.BANK_STATUS_CANCELLED',
};

export const BANK_STATUS_COLORS: Readonly<Record<SupplierBankChangeStatus, string>> = {
  pending: 'gold',
  applied: 'green',
  rejected: 'red',
  cancelled: 'default',
};

export const CHECK_TYPE_LABELS: Readonly<Record<SupplierCheckType, string>> = {
  vies_vat: 'SUPPLIER_PORTAL.CHECK_VIES_VAT',
  vat_status: 'SUPPLIER_PORTAL.CHECK_VAT_STATUS',
  antimafia: 'SUPPLIER_PORTAL.CHECK_ANTIMAFIA',
  sanctions: 'SUPPLIER_PORTAL.CHECK_SANCTIONS',
  business_register: 'SUPPLIER_PORTAL.CHECK_BUSINESS_REGISTER',
  durc_online: 'SUPPLIER_PORTAL.CHECK_DURC_ONLINE',
  other: 'SUPPLIER_PORTAL.CHECK_OTHER',
};

export const CHECK_RESULT_LABELS: Readonly<Record<SupplierCheckResult, string>> = {
  pending: 'SUPPLIER_PORTAL.CHECK_RESULT_PENDING',
  passed: 'SUPPLIER_PORTAL.CHECK_RESULT_PASSED',
  failed: 'SUPPLIER_PORTAL.CHECK_RESULT_FAILED',
};

/** Reasons of a risk flag and blockers of an approval, by the code the API sends. */
export const REASON_LABELS: Readonly<Record<string, string>> = {
  document_expired: 'SUPPLIER_PORTAL.REASON_DOCUMENT_EXPIRED',
  document_expiring: 'SUPPLIER_PORTAL.REASON_DOCUMENT_EXPIRING',
  document_missing: 'SUPPLIER_PORTAL.REASON_DOCUMENT_MISSING',
  document_not_accepted: 'SUPPLIER_PORTAL.REASON_DOCUMENT_NOT_ACCEPTED',
  onboarding_blocked: 'SUPPLIER_PORTAL.REASON_ONBOARDING_BLOCKED',
  vat_blocked: 'SUPPLIER_PORTAL.REASON_VAT_BLOCKED',
  vat_invalid: 'SUPPLIER_PORTAL.REASON_VAT_INVALID',
  sanctions_hit: 'SUPPLIER_PORTAL.REASON_SANCTIONS_HIT',
  check_failed: 'SUPPLIER_PORTAL.REASON_CHECK_FAILED',
  check_pending: 'SUPPLIER_PORTAL.REASON_CHECK_PENDING',
  check_outdated: 'SUPPLIER_PORTAL.REASON_CHECK_OUTDATED',
  qualification_expired: 'SUPPLIER_PORTAL.REASON_QUALIFICATION_EXPIRED',
  qualification_missing: 'SUPPLIER_PORTAL.REASON_QUALIFICATION_MISSING',
  qualification_not_passed: 'SUPPLIER_PORTAL.REASON_QUALIFICATION_NOT_PASSED',
  risk_critical: 'SUPPLIER_PORTAL.REASON_RISK_CRITICAL',
};

/** Label key of a reason code, with a generic one for a code this version does not know. */
export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? 'SUPPLIER_PORTAL.REASON_UNKNOWN';
}

/** Colour of the days left before a document expires: red once expired, orange within a month. */
export function expiryColor(daysToExpiry: number | null | undefined): string {
  if (daysToExpiry === null || daysToExpiry === undefined) {
    return 'default';
  }
  if (daysToExpiry < 0) {
    return 'red';
  }
  return daysToExpiry <= 30 ? 'orange' : 'green';
}

/** IBAN in groups of four characters, as it is read aloud on a callback. */
export function formatIban(iban: string | null | undefined): string {
  return (iban ?? '').replace(/(.{4})/g, '$1 ').trim();
}
