import { AccountingImportPayload, EmployeeNetInput } from '@core';

/** The amounts of the accounting summary the user types, in the order they appear on the consultant's prospetto. */
export const AMOUNT_FIELDS = [
  { key: 'total_gross_wages', required: true },
  { key: 'inps_employee_withholding', required: true },
  { key: 'inps_employer_contribution', required: true },
  { key: 'irpef_withholding', required: true },
  { key: 'regional_municipal_addizionali', required: true },
  { key: 'tfr_monthly_accrual', required: true },
  { key: 'tfr_fondo_tesoreria_or_previdenza', required: true },
  { key: 'inail_accrual', required: false },
  { key: 'net_payable', required: true },
] as const;

export type AmountKey = (typeof AMOUNT_FIELDS)[number]['key'];

/** The TFR quota of the year divided by this, minus the 0.50% INPS contribution (art. 2120 c.c.). */
const TFR_DIVISOR = 13.5;
const INPS_TFR_RATE = 0.005;

/** A TFR accrual within this share of the formula is accepted; the consultant may exclude some pay components. */
const TFR_FORMULA_TOLERANCE = 0.01;

/** Euro typed as text or number to whole cents; null when empty or not a number. Euro have exactly two decimals. */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value.trim().replace(',', '.'));

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export type CheckId = 'net' | 'tfr' | 'employee_nets' | 'journal' | 'tfr_formula';

export interface ReconciliationCheck {
  id: CheckId;
  /** What the consultant states (or what the posting would credit). */
  stated: number;
  /** What the aggregates calculate (or what the posting would debit). */
  calculated: number;
  difference: number;
  ok: boolean;
  /** An error blocks the import, a warning only asks the user to look. */
  severity: 'error' | 'warning';
}

export interface Reconciliation {
  checks: ReconciliationCheck[];
  missing: AmountKey[];
  canImport: boolean;
}

export type CentsByKey = Partial<Record<AmountKey, number | null>>;

function check(
  id: CheckId,
  stated: number,
  calculated: number,
  severity: 'error' | 'warning',
  tolerance = 0,
): ReconciliationCheck {
  const difference = stated - calculated;

  return { id, stated, calculated, difference, ok: Math.abs(difference) <= tolerance, severity };
}

/**
 * Compares the stated summary with what the aggregates calculate, in whole cents so that no float error appears.
 * `employeeNets` are the net of each payslip (empty when none were given yet).
 */
export function reconcile(values: CentsByKey, employeeNets: readonly number[]): Reconciliation {
  const value = (key: AmountKey): number => values[key] ?? 0;
  const missing = AMOUNT_FIELDS.filter(
    (field) => field.required && (values[field.key] ?? null) === null,
  ).map((field) => field.key);

  const gross = value('total_gross_wages');
  const employeeInps = value('inps_employee_withholding');
  const employerInps = value('inps_employer_contribution');
  const irpef = value('irpef_withholding');
  const addizionali = value('regional_municipal_addizionali');
  const tfrAccrual = value('tfr_monthly_accrual');
  const tfrFund = value('tfr_fondo_tesoreria_or_previdenza');
  const net = value('net_payable');

  const debits = gross + employerInps + tfrAccrual;
  const credits = net + employerInps + employeeInps + irpef + addizionali + tfrFund;
  const tfrFormula = Math.round(gross / TFR_DIVISOR - gross * INPS_TFR_RATE);

  const checks: ReconciliationCheck[] = [
    check('net', net, gross - employeeInps - irpef - addizionali, 'error'),
    check('tfr', tfrFund, tfrAccrual, 'error'),
    check(
      'employee_nets',
      employeeNets.reduce((sum, cents) => sum + cents, 0),
      net,
      'error',
    ),
    check('journal', credits, debits, 'error'),
    check(
      'tfr_formula',
      tfrAccrual,
      tfrFormula,
      'warning',
      Math.round(Math.abs(tfrFormula) * TFR_FORMULA_TOLERANCE),
    ),
  ];

  const blocking = checks.some((item) => item.severity === 'error' && !item.ok);

  return {
    checks,
    missing,
    canImport: missing.length === 0 && employeeNets.length > 0 && !blocking,
  };
}

export interface NetsParseError {
  line: number;
  reason: 'format' | 'employee' | 'amount' | 'duplicate';
}

export interface NetsParseResult {
  rows: EmployeeNetInput[];
  errors: NetsParseError[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads the nets of the employees from pasted lines `employee id;net` (separator `;`, `,` or tab; a header line and
 * blank lines are skipped). Each problem is reported with its line number instead of failing the whole paste.
 */
export function parseEmployeeNets(text: string): NetsParseResult {
  const rows: EmployeeNetInput[] = [];
  const errors: NetsParseError[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const content = raw.trim();

    if (content === '') {
      return;
    }

    // `;` or tab separate the fields (so that the amount may use a decimal comma); with neither, the last comma does.
    const separator = /[;\t]/.test(content) ? content.search(/[;\t]/) : content.lastIndexOf(',');
    const employeeId = separator < 0 ? '' : content.slice(0, separator).trim();
    const amount = separator < 0 ? '' : content.slice(separator + 1).trim();

    if (separator < 0 || /[;\t]/.test(amount)) {
      errors.push({ line, reason: 'format' });

      return;
    }

    if (!UUID.test(employeeId)) {
      // A header such as "employee_id;net" has no UUID and no amount: it is not an error.
      if (index === 0 && toCents(amount) === null) {
        return;
      }

      errors.push({ line, reason: 'employee' });

      return;
    }

    const cents = toCents(amount);

    if (cents === null || cents <= 0) {
      errors.push({ line, reason: 'amount' });

      return;
    }

    const id = employeeId.toLowerCase();

    if (seen.has(id)) {
      errors.push({ line, reason: 'duplicate' });

      return;
    }

    seen.add(id);
    rows.push({ employee_id: id, net_amount: cents / 100 });
  });

  return { rows, errors };
}

/** The request body of the import: whole-cent amounts back to euro, optional ones only when typed. */
export function toAccountingPayload(
  values: CentsByKey,
  employeeNets: EmployeeNetInput[],
  companyId: string | null,
): AccountingImportPayload {
  const euro = (key: AmountKey): number => (values[key] ?? 0) / 100;

  const payload: AccountingImportPayload = {
    total_gross_wages: euro('total_gross_wages'),
    inps_employee_withholding: euro('inps_employee_withholding'),
    inps_employer_contribution: euro('inps_employer_contribution'),
    irpef_withholding: euro('irpef_withholding'),
    regional_municipal_addizionali: euro('regional_municipal_addizionali'),
    tfr_monthly_accrual: euro('tfr_monthly_accrual'),
    tfr_fondo_tesoreria_or_previdenza: euro('tfr_fondo_tesoreria_or_previdenza'),
    net_payable: euro('net_payable'),
    employee_nets: employeeNets,
  };

  if ((values['inail_accrual'] ?? null) !== null) {
    payload.inail_accrual = euro('inail_accrual');
  }

  if (companyId) {
    payload.company_id = companyId;
  }

  return payload;
}
