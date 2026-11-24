import { ItalianPayrollPeriod, ItalianPayrollStatus } from '@core';

/** The five stages of the monthly closing, in the order of the stepper. */
export type ClosingStepId = 'attendance' | 'validation' | 'export' | 'import' | 'sepa';

export const CLOSING_STEPS: readonly ClosingStepId[] = [
  'attendance',
  'validation',
  'export',
  'import',
  'sepa',
];

export type ClosingStepState = 'finish' | 'process' | 'wait' | 'error';

const STATUS_RANK: Record<ItalianPayrollStatus, number> = {
  attendance_open: 0,
  validated: 1,
  exported_to_cdl: 2,
  cedolini_imported: 3,
  paid: 4,
};

export function statusRank(status: ItalianPayrollStatus): number {
  return STATUS_RANK[status];
}

/** A month that was checked and still has errors stays open: the validation stage is where the user is stuck. */
export function hasValidationErrors(period: ItalianPayrollPeriod): boolean {
  return period.status === 'attendance_open' && (period.validation_report?.errors.length ?? 0) > 0;
}

/**
 * The stage the month is in: 0 collecting attendance, 1 fixing the validation report, 2 exporting to the consultant,
 * 3 importing payslips and the accounting summary, 4 paying. A paid month is past the last stage (5).
 */
export function activeStepIndex(period: ItalianPayrollPeriod): number {
  switch (period.status) {
    case 'attendance_open':
      return period.validation_report ? 1 : 0;
    case 'validated':
      return 2;
    case 'exported_to_cdl':
      return 3;
    case 'cedolini_imported':
      return period.accounting_imported ? 4 : 3;
    case 'paid':
      return CLOSING_STEPS.length;
  }
}

export function stepState(period: ItalianPayrollPeriod, index: number): ClosingStepState {
  const active = activeStepIndex(period);

  if (index < active) {
    return 'finish';
  }

  if (index === active) {
    return hasValidationErrors(period) && index === 1 ? 'error' : 'process';
  }

  return 'wait';
}

export interface ClosingActions {
  validate: boolean;
  exportFile: boolean;
  importCedolini: boolean;
  importAccounting: boolean;
  sepa: boolean;
  markPaid: boolean;
}

/** What the API accepts in the current state; the buttons mirror it so that the user never meets a 422 for order. */
export function closingActions(period: ItalianPayrollPeriod): ClosingActions {
  const rank = statusRank(period.status);
  const awaitingImports =
    period.status === 'exported_to_cdl' || period.status === 'cedolini_imported';

  return {
    validate: period.status === 'attendance_open',
    exportFile: rank >= STATUS_RANK.validated,
    importCedolini: awaitingImports,
    importAccounting: awaitingImports && !period.accounting_imported,
    sepa: period.status === 'cedolini_imported' && period.accounting_imported,
    markPaid: period.status === 'cedolini_imported' && period.accounting_imported,
  };
}
