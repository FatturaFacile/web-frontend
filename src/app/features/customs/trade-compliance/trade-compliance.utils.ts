import {
  CustomsDeclarationStatus,
  CustomsDirection,
  CustomsImportBillStatus,
  CustomsRegime,
  CustomsTransitDocumentType,
} from '@core';

export const CUSTOMS_DIRECTIONS: readonly CustomsDirection[] = ['import', 'export', 'transit'];
export const CUSTOMS_REGIMES: readonly CustomsRegime[] = ['edec', 'passar', 'aida'];
export const CUSTOMS_TRANSIT_DOCUMENTS: readonly CustomsTransitDocumentType[] = ['none', 'T1', 'T2'];
export const CUSTOMS_DECLARATION_STATUSES: readonly CustomsDeclarationStatus[] = [
  'draft',
  'validated',
  'submitted',
  'accepted',
  'rejected',
  'cancelled',
];

/** Union MRN has 18 characters, a Swiss one 18 to 21 uppercase alphanumerics; the API makes the final call. */
export const MRN_PATTERN = /^[A-Z0-9]{18,21}$/;

export function normalizeMrn(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function isPlausibleMrn(value: string): boolean {
  return MRN_PATTERN.test(normalizeMrn(value));
}

/** Rounds half away from zero to cents without the usual binary floating point drift (1.005 -> 1.01). */
export function roundCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 * (1 + Number.EPSILON))) / 100;
}

/** Import VAT preview, identical to the API rule: (value + duty + ancillary costs) * rate / 100, two decimals. */
export function computeImportVat(
  customsValue: number | null | undefined,
  duty: number | null | undefined,
  ancillary: number | null | undefined,
  ratePercent: number | null | undefined,
): number {
  const base = (customsValue ?? 0) + (duty ?? 0) + (ancillary ?? 0);
  return roundCents((base * (ratePercent ?? 0)) / 100);
}

/** A transit declaration is overdue when its deadline passed and it has not been discharged. */
export function isTransitOverdue(
  deadline: string | null | undefined,
  dischargedAt: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!deadline || dischargedAt) {
    return false;
  }
  const limit = new Date(`${deadline.slice(0, 10)}T23:59:59`);
  return limit.getTime() < today.getTime();
}

export function declarationStatusColor(status: CustomsDeclarationStatus): string {
  const colors: Record<CustomsDeclarationStatus, string> = {
    draft: 'default',
    validated: 'blue',
    submitted: 'processing',
    accepted: 'success',
    rejected: 'error',
    cancelled: 'default',
  };
  return colors[status] ?? 'default';
}

export function billStatusColor(status: CustomsImportBillStatus): string {
  return status === 'posted' ? 'success' : 'default';
}

/** Dashboard counters in a stable order; unknown keys the API may add are appended. */
export function orderedCounts(
  counts: Record<string, number> | null | undefined,
  order: readonly string[],
): { key: string; count: number }[] {
  const source = counts ?? {};
  const known = order.map((key) => ({ key, count: source[key] ?? 0 }));
  const extra = Object.keys(source)
    .filter((key) => !order.includes(key))
    .map((key) => ({ key, count: source[key] }));
  return [...known, ...extra];
}
