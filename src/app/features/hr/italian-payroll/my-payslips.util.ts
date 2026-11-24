import { MyPayslip, PayslipDocumentKind } from '@core';

export interface PayslipYearGroup {
  year: number;
  payslips: MyPayslip[];
}

/** Years newest first, and inside a year the months newest first. */
export function groupPayslipsByYear(payslips: readonly MyPayslip[]): PayslipYearGroup[] {
  const byYear = new Map<number, MyPayslip[]>();

  for (const payslip of payslips) {
    byYear.set(payslip.year, [...(byYear.get(payslip.year) ?? []), payslip]);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({ year, payslips: [...list].sort((a, b) => b.month - a.month) }));
}

/** The documents that exist for a row, cedolino first. */
export function availableDocuments(payslip: MyPayslip): PayslipDocumentKind[] {
  const kinds: PayslipDocumentKind[] = [];

  if (payslip.has_cedolino) {
    kinds.push('cedolino');
  }

  if (payslip.has_cu) {
    kinds.push('cu');
  }

  return kinds;
}

/** `cedolino-2027-03.pdf` and `CU-2027.pdf`. */
export function payslipFilename(
  payslip: Pick<MyPayslip, 'year' | 'month'>,
  kind: PayslipDocumentKind,
): string {
  return kind === 'cu'
    ? `CU-${payslip.year}.pdf`
    : `cedolino-${payslip.year}-${String(payslip.month).padStart(2, '0')}.pdf`;
}
