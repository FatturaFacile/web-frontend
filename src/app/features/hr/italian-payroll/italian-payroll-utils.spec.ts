import { describe, expect, it } from 'vitest';
import { ItalianPayrollPeriod } from '@core';
import {
  activeStepIndex,
  closingActions,
  hasValidationErrors,
  stepState,
} from './closing-workflow.util';
import {
  CentsByKey,
  parseEmployeeNets,
  reconcile,
  toAccountingPayload,
  toCents,
} from './accounting-reconciliation.util';

const period = (over: Partial<ItalianPayrollPeriod> = {}): ItalianPayrollPeriod => ({
  id: 'p1',
  legal_entity_id: null,
  year: 2027,
  month: 3,
  include_tredicesima: false,
  include_quattordicesima: false,
  status: 'attendance_open',
  export_format: null,
  validated_at: null,
  exported_at: null,
  paid_at: null,
  validation_report: null,
  accounting_imported: false,
  ...over,
});

describe('closing workflow', () => {
  it('maps every status to the stage of the stepper', () => {
    expect(activeStepIndex(period())).toBe(0);
    expect(activeStepIndex(period({ validation_report: { errors: [], warnings: [] } }))).toBe(1);
    expect(activeStepIndex(period({ status: 'validated' }))).toBe(2);
    expect(activeStepIndex(period({ status: 'exported_to_cdl' }))).toBe(3);
    expect(activeStepIndex(period({ status: 'cedolini_imported' }))).toBe(3);
    expect(
      activeStepIndex(period({ status: 'cedolini_imported', accounting_imported: true })),
    ).toBe(4);
    expect(activeStepIndex(period({ status: 'paid', accounting_imported: true }))).toBe(5);
  });

  it('flags the validation stage as an error while the report has errors', () => {
    const stuck = period({
      validation_report: {
        errors: [{ employee_id: 'e1', code: 'missing_tax_code', message: 'x' }],
        warnings: [],
      },
    });

    expect(hasValidationErrors(stuck)).toBe(true);
    expect(stepState(stuck, 0)).toBe('finish');
    expect(stepState(stuck, 1)).toBe('error');
    expect(stepState(stuck, 2)).toBe('wait');
    expect(stepState(period({ status: 'paid', accounting_imported: true }), 4)).toBe('finish');
  });

  it('allows only the actions the API accepts in each state', () => {
    expect(closingActions(period())).toMatchObject({
      validate: true,
      exportFile: false,
      importCedolini: false,
      sepa: false,
      markPaid: false,
    });
    expect(closingActions(period({ status: 'validated' }))).toMatchObject({
      validate: false,
      exportFile: true,
      importCedolini: false,
    });
    expect(closingActions(period({ status: 'exported_to_cdl' }))).toMatchObject({
      importCedolini: true,
      importAccounting: true,
      sepa: false,
    });

    const imported = closingActions(
      period({ status: 'cedolini_imported', accounting_imported: true }),
    );
    expect(imported).toMatchObject({ importAccounting: false, sepa: true, markPaid: true });

    const withoutAccounting = closingActions(period({ status: 'cedolini_imported' }));
    expect(withoutAccounting).toMatchObject({
      importAccounting: true,
      sepa: false,
      markPaid: false,
    });

    expect(closingActions(period({ status: 'paid', accounting_imported: true }))).toMatchObject({
      importCedolini: false,
      sepa: false,
      markPaid: false,
    });
  });
});

const cents = (euro: Record<string, number>): CentsByKey =>
  Object.fromEntries(Object.entries(euro).map(([key, value]) => [key, Math.round(value * 100)]));

const balanced = cents({
  total_gross_wages: 5000,
  inps_employee_withholding: 459.5,
  inps_employer_contribution: 1500,
  irpef_withholding: 700,
  regional_municipal_addizionali: 60,
  // 5000 / 13.5 - 0.5% of 5000 = 345.37
  tfr_monthly_accrual: 345.37,
  tfr_fondo_tesoreria_or_previdenza: 345.37,
  net_payable: 3780.5,
});

describe('accounting reconciliation', () => {
  it('reads euro as whole cents without float drift', () => {
    expect(toCents('1234,56')).toBe(123456);
    expect(toCents('0.1')).toBe(10);
    expect(toCents(459.5)).toBe(45950);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents('')).toBeNull();
    expect(toCents('abc')).toBeNull();
  });

  it('accepts a summary that balances and whose nets add up', () => {
    const result = reconcile(balanced, [200000, 178050]);

    expect(result.canImport).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.checks.every((item) => item.ok)).toBe(true);
    // debits: gross 5000 + employer INPS 1500 + TFR 345.37; credits: net + INPS 1959.50 + IRPEF + surtaxes + TFR fund
    expect(result.checks.find((item) => item.id === 'journal')).toMatchObject({
      stated: 684537,
      calculated: 684537,
      difference: 0,
    });
  });

  it('refuses a net that is not gross minus the deductions, and shows the gap', () => {
    const result = reconcile({ ...balanced, net_payable: 300000 }, [300000]);
    const net = result.checks.find((item) => item.id === 'net');

    expect(result.canImport).toBe(false);
    expect(net).toMatchObject({ ok: false, difference: 300000 - 378050 });
  });

  it('refuses nets that do not add up to the net payable, or none at all', () => {
    expect(reconcile(balanced, [200000, 100000]).canImport).toBe(false);
    expect(reconcile(balanced, []).canImport).toBe(false);
  });

  it('refuses a TFR accrual that differs from the TFR fund credit', () => {
    const result = reconcile({ ...balanced, tfr_fondo_tesoreria_or_previdenza: 36000 }, [378050]);

    expect(result.checks.find((item) => item.id === 'tfr')?.ok).toBe(false);
    expect(result.canImport).toBe(false);
  });

  it('only warns when the TFR differs from the 13.5 formula, and does not block the import', () => {
    const result = reconcile(
      { ...balanced, tfr_monthly_accrual: 50000, tfr_fondo_tesoreria_or_previdenza: 50000 },
      [378050],
    );
    const formula = result.checks.find((item) => item.id === 'tfr_formula');

    expect(formula).toMatchObject({ ok: false, severity: 'warning' });
    // gross 5000 / 13.5 - 0.5% = 345.37 euro
    expect(formula?.calculated).toBe(34537);
    expect(result.canImport).toBe(true);
  });

  it('lists the required amounts that were not typed', () => {
    const result = reconcile({ total_gross_wages: 100000 }, [100000]);

    expect(result.missing).toContain('net_payable');
    expect(result.missing).not.toContain('inail_accrual');
    expect(result.canImport).toBe(false);
  });

  it('builds the request body in euro, with the optional fields only when given', () => {
    const body = toAccountingPayload(
      { ...balanced, inail_accrual: 1234 },
      [{ employee_id: 'e1', net_amount: 1 }],
      'c1',
    );

    expect(body).toMatchObject({
      total_gross_wages: 5000,
      net_payable: 3780.5,
      inail_accrual: 12.34,
      company_id: 'c1',
    });
    expect(toAccountingPayload(balanced, [], null)).not.toHaveProperty('inail_accrual');
    expect(toAccountingPayload(balanced, [], null)).not.toHaveProperty('company_id');
  });
});

const ID_A = '0191a7e0-5b7c-7c2e-8f5b-3b1a2c4d5e6f';
const ID_B = '0191a7e0-5b7c-7c2e-8f5b-3b1a2c4d5e70';

describe('parseEmployeeNets', () => {
  it('reads semicolon, comma and tab lines, a header and decimal commas', () => {
    const result = parseEmployeeNets(`employee_id;net\n${ID_A};1500,50\n\n${ID_B}\t999.90`);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { employee_id: ID_A, net_amount: 1500.5 },
      { employee_id: ID_B, net_amount: 999.9 },
    ]);
    expect(parseEmployeeNets(`${ID_A},1500.50`).rows).toEqual([
      { employee_id: ID_A, net_amount: 1500.5 },
    ]);
  });

  it('reports each bad line with its number instead of failing the whole paste', () => {
    const result = parseEmployeeNets(
      `${ID_A};100\nnot-an-id;50\n${ID_B};abc\n${ID_A};70\njust-one-field`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      { line: 2, reason: 'employee' },
      { line: 3, reason: 'amount' },
      { line: 4, reason: 'duplicate' },
      { line: 5, reason: 'format' },
    ]);
  });

  it('refuses zero and negative nets', () => {
    expect(parseEmployeeNets(`${ID_A};0`).errors).toEqual([{ line: 1, reason: 'amount' }]);
    expect(parseEmployeeNets(`${ID_A};-5`).errors).toEqual([{ line: 1, reason: 'amount' }]);
  });
});
