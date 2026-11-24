import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  agentFormOf,
  agentPayloadOf,
  bracketPayloadOf,
  bracketsAreValid,
  canApproveStatement,
  canPayStatement,
  canPrepareSelfBilling,
  canSendStatement,
  canVoidStatement,
  cuFileName,
  currentMonth,
  currentQuarter,
  DEFAULT_AGENT_FORM,
  DEFAULT_RULE_FORM,
  DEFAULT_ZONE_FORM,
  dimensionName,
  emptyTierRow,
  enasarcoFileName,
  entryStatusColor,
  errorKey,
  failureOf,
  fiscalOverrideOf,
  formatRate,
  inRange,
  isAgentFormValid,
  isFiscalFormValid,
  isLockedEntry,
  isNonZero,
  isParameterValueValid,
  isRuleFormValid,
  isZoneFormValid,
  monthBounds,
  parentCandidates,
  parseRegions,
  periodOf,
  problemOf,
  progressPercent,
  quarterBounds,
  ruleFormOf,
  rulePayloadOf,
  selectableYears,
  statementFileName,
  statementStatusColor,
  summaryOfPreview,
  summaryOfStatement,
  tierPayloadOf,
  tierRowsOf,
  tiersAreValid,
  todayParam,
  zoneFormOf,
  zonePayloadOf,
} from './agent-commissions.util';
import { agent, preview, rule, statement, zone } from './agent-commissions.testing';

describe('errors', () => {
  it('maps a problem code to its translation key and falls back to the generic one', () => {
    expect(errorKey('payout_blocked')).toBe('agentCommissions.error.payout_blocked');
    expect(errorKey(undefined)).toBe('agentCommissions.error.generic');
    expect(errorKey(null)).toBe('agentCommissions.error.generic');
  });

  it('reads the code of a problem details answer and its validation errors', async () => {
    const problem = new HttpErrorResponse({
      status: 422,
      error: { code: 'nothing_to_settle', detail: 'No commission is due.' },
    });
    const failure = await failureOf(problem);
    expect(failure.ok).toBe(false);
    expect(failure.errorKey).toBe('agentCommissions.error.nothing_to_settle');
    expect(failure.detail).toBe('No commission is due.');

    const validation = await failureOf(
      new HttpErrorResponse({ status: 422, error: { errors: { name: ['Required'] } } }),
    );
    expect(validation.errorKey).toBe('agentCommissions.error.generic');
    expect(validation.errors).toEqual({ name: ['Required'] });
    expect(validation.detail).toBe('Required');
  });

  it('reads the problem of a failed download, whose body is a Blob', async () => {
    const blob = new Blob([JSON.stringify({ code: 'invalid_period' })], {
      type: 'application/json',
    });
    const problem = await problemOf(new HttpErrorResponse({ status: 422, error: blob }));
    expect(problem?.code).toBe('invalid_period');

    expect(
      await problemOf(new HttpErrorResponse({ status: 500, error: new Blob(['not json']) })),
    ).toBeNull();
    expect(await problemOf(new Error('network'))).toBeNull();
  });
});

describe('statement workflow', () => {
  const at = (status: 'draft' | 'approved' | 'invoiced' | 'paid' | 'void') => ({ status });

  it('approves only a draft', () => {
    expect(canApproveStatement(at('draft'))).toBe(true);
    for (const status of ['approved', 'invoiced', 'paid', 'void'] as const) {
      expect(canApproveStatement(at(status))).toBe(false);
    }
  });

  it('voids a draft or an approved statement only', () => {
    expect(canVoidStatement(at('draft'))).toBe(true);
    expect(canVoidStatement(at('approved'))).toBe(true);
    expect(canVoidStatement(at('invoiced'))).toBe(false);
    expect(canVoidStatement(at('paid'))).toBe(false);
    expect(canVoidStatement(at('void'))).toBe(false);
  });

  it('prepares the invoice for an approved statement of an agent not settled on salary', () => {
    expect(canPrepareSelfBilling({ status: 'approved', settlement_channel: 'invoice' })).toBe(true);
    expect(canPrepareSelfBilling({ status: 'approved', settlement_channel: 'salary' })).toBe(false);
    expect(canPrepareSelfBilling({ status: 'draft', settlement_channel: 'invoice' })).toBe(false);
    expect(canPrepareSelfBilling({ status: 'invoiced', settlement_channel: 'invoice' })).toBe(
      false,
    );
  });

  it('pays an approved or invoiced statement and sends any that is not void', () => {
    expect(canPayStatement(at('approved'))).toBe(true);
    expect(canPayStatement(at('invoiced'))).toBe(true);
    expect(canPayStatement(at('draft'))).toBe(false);
    expect(canPayStatement(at('paid'))).toBe(false);
    expect(canSendStatement(at('draft'))).toBe(true);
    expect(canSendStatement(at('paid'))).toBe(true);
    expect(canSendStatement(at('void'))).toBe(false);
  });
});

describe('status and lock mapping', () => {
  it('locks a cash-basis entry that waits for a reconciled collection', () => {
    for (const status of [
      'pending_collection',
      'awaiting_reconciliation',
      'partially_eligible',
    ] as const) {
      expect(isLockedEntry({ accrual_basis: 'collected', status })).toBe(true);
      expect(isLockedEntry({ accrual_basis: 'invoiced', status })).toBe(false);
    }
    expect(isLockedEntry({ accrual_basis: 'collected', status: 'eligible' })).toBe(false);
    expect(isLockedEntry({ accrual_basis: 'collected', status: 'settled' })).toBe(false);
  });

  it('gives each status a colour', () => {
    expect(entryStatusColor('eligible')).toBe('green');
    expect(entryStatusColor('settled')).toBe('blue');
    expect(entryStatusColor('awaiting_reconciliation')).toBe('orange');
    expect(entryStatusColor('cancelled')).toBe('default');
    expect(statementStatusColor('paid')).toBe('green');
    expect(statementStatusColor('void')).toBe('default');
    expect(statementStatusColor('draft')).toBe('gold');
  });
});

describe('agent form', () => {
  it('builds the payload of a new agent with the representative', () => {
    const payload = agentPayloadOf(
      { ...DEFAULT_AGENT_FORM, sales_representative_id: 'rep-1', default_rate: 6.5 },
      true,
    );

    expect(payload.sales_representative_id).toBe('rep-1');
    expect(payload.agent_type).toBe('direct');
    expect(payload.fiscal_regime).toBe('enasarco');
    expect(payload.enasarco_mandate).toBe('single');
    expect(payload.default_rate).toBe(6.5);
    expect(payload.tax_code).toBeNull();
    expect(payload.contract_start).toBeNull();
  });

  it('never sends the representative on an update', () => {
    const payload = agentPayloadOf(
      { ...DEFAULT_AGENT_FORM, sales_representative_id: 'rep-1' },
      false,
    );

    expect(payload).not.toHaveProperty('sales_representative_id');
  });

  it('sends the parent and the split of a sub-agent only', () => {
    const base = {
      ...DEFAULT_AGENT_FORM,
      parent_agent_profile_id: 'a-9',
      parent_split_mode: 'additional_rate' as const,
      parent_split_value: 1.5,
    };

    const sub = agentPayloadOf({ ...base, agent_type: 'sub_agent' }, false);
    expect(sub.parent_agent_profile_id).toBe('a-9');
    expect(sub.parent_split_mode).toBe('additional_rate');
    expect(sub.parent_split_value).toBe(1.5);

    const direct = agentPayloadOf({ ...base, agent_type: 'direct' }, false);
    expect(direct.parent_agent_profile_id).toBeNull();
    expect(direct.parent_split_mode).toBeNull();
    expect(direct.parent_split_value).toBeNull();
  });

  it('drops the mandate and the FIRR for a Swiss or no-regime agent', () => {
    const payload = agentPayloadOf(
      {
        ...DEFAULT_AGENT_FORM,
        fiscal_regime: 'swiss_direct',
        enasarco_mandate: 'multi',
        firr_enabled: true,
      },
      false,
    );

    expect(payload.enasarco_mandate).toBeNull();
    expect(payload.firr_enabled).toBe(false);
  });

  it('validates the representative, the contract dates, the split and the rate', () => {
    expect(isAgentFormValid(DEFAULT_AGENT_FORM, true)).toBe(false);
    expect(isAgentFormValid({ ...DEFAULT_AGENT_FORM, sales_representative_id: 'r' }, true)).toBe(
      true,
    );
    expect(isAgentFormValid(DEFAULT_AGENT_FORM, false)).toBe(true);
    expect(
      isAgentFormValid(
        { ...DEFAULT_AGENT_FORM, contract_start: '2026-05-01', contract_end: '2026-04-01' },
        false,
      ),
    ).toBe(false);
    expect(isAgentFormValid({ ...DEFAULT_AGENT_FORM, default_rate: 120 }, false)).toBe(false);
    expect(
      isAgentFormValid(
        {
          ...DEFAULT_AGENT_FORM,
          agent_type: 'sub_agent',
          parent_agent_profile_id: 'a-9',
          parent_split_mode: null,
        },
        false,
      ),
    ).toBe(false);
    expect(
      isAgentFormValid(
        {
          ...DEFAULT_AGENT_FORM,
          agent_type: 'sub_agent',
          parent_agent_profile_id: 'a-9',
          parent_split_mode: 'share_of_commission',
          parent_split_value: 30,
        },
        false,
      ),
    ).toBe(true);
  });

  it('reads an agent profile back into the form', () => {
    const form = agentFormOf(
      agent('a-1', { default_rate: '6.5000', notes: null, tax_code: 'RSSMRA' }),
    );

    expect(form.default_rate).toBe(6.5);
    expect(form.notes).toBe('');
    expect(form.tax_code).toBe('RSSMRA');
    expect(form.accrual_basis).toBe('collected');
  });

  it('offers as parent the active agents that are not sub-agents, never the agent itself', () => {
    const agents = [
      agent('a-1'),
      agent('a-2', { is_active: false }),
      agent('a-3', { parent_agent_profile_id: 'a-1', agent_type: 'sub_agent' }),
      agent('a-4'),
    ];

    expect(parentCandidates(agents, 'a-1').map((entry) => entry.id)).toEqual(['a-4']);
    expect(parentCandidates(agents, null).map((entry) => entry.id)).toEqual(['a-1', 'a-4']);
  });
});

describe('tiers', () => {
  it('accepts tiers that start at zero, are contiguous and end open', () => {
    expect(tiersAreValid([])).toBe(true);
    expect(
      tiersAreValid([
        { from: 0, to: 10000, rate: 3 },
        { from: 10000, to: 50000, rate: 4 },
        { from: 50000, to: null, rate: 5 },
      ]),
    ).toBe(true);
  });

  it('refuses a gap, an overlap, a start above zero, an open tier in the middle or a bad rate', () => {
    expect(tiersAreValid([{ from: 100, to: null, rate: 3 }])).toBe(false);
    expect(
      tiersAreValid([
        { from: 0, to: 10000, rate: 3 },
        { from: 12000, to: null, rate: 4 },
      ]),
    ).toBe(false);
    expect(
      tiersAreValid([
        { from: 0, to: 10000, rate: 3 },
        { from: 9000, to: null, rate: 4 },
      ]),
    ).toBe(false);
    expect(
      tiersAreValid([
        { from: 0, to: null, rate: 3 },
        { from: 10000, to: null, rate: 4 },
      ]),
    ).toBe(false);
    expect(tiersAreValid([{ from: 0, to: 0, rate: 3 }])).toBe(false);
    expect(tiersAreValid([{ from: 0, to: null, rate: 101 }])).toBe(false);
    expect(tiersAreValid([{ from: 0, to: null, rate: null }])).toBe(false);
  });

  it('continues from the end of the previous tier when a row is added', () => {
    expect(emptyTierRow()).toEqual({ from: 0, to: null, rate: null });
    expect(emptyTierRow({ from: 0, to: 10000, rate: 3 })).toEqual({
      from: 10000,
      to: null,
      rate: null,
    });
  });

  it('converts the tiers between the wire and the editor', () => {
    const rows = tierRowsOf([
      { threshold_from: '0.00', threshold_to: '10000.00', rate: '3.0000' },
      { threshold_from: '10000.00', threshold_to: null, rate: '4.0000' },
    ]);

    expect(rows).toEqual([
      { from: 0, to: 10000, rate: 3 },
      { from: 10000, to: null, rate: 4 },
    ]);
    expect(tierPayloadOf(rows)).toEqual([
      { threshold_from: 0, threshold_to: 10000, rate: 3 },
      { threshold_from: 10000, threshold_to: null, rate: 4 },
    ]);
  });
});

describe('rule form', () => {
  it('needs a name and a rate for a percentage rule, an amount for a fixed one', () => {
    expect(isRuleFormValid(DEFAULT_RULE_FORM, [])).toBe(false);
    expect(isRuleFormValid({ ...DEFAULT_RULE_FORM, name: 'R', rate: 5 }, [])).toBe(true);
    expect(isRuleFormValid({ ...DEFAULT_RULE_FORM, name: 'R', rate: 120 }, [])).toBe(false);
    expect(isRuleFormValid({ ...DEFAULT_RULE_FORM, name: 'R', rate_type: 'fixed' }, [])).toBe(
      false,
    );
    expect(
      isRuleFormValid(
        { ...DEFAULT_RULE_FORM, name: 'R', rate_type: 'fixed', fixed_amount: 25 },
        [],
      ),
    ).toBe(true);
  });

  it('accepts tiers in place of the rate, and refuses invalid tiers', () => {
    const form = { ...DEFAULT_RULE_FORM, name: 'R' };

    expect(isRuleFormValid(form, [{ from: 0, to: null, rate: 3 }])).toBe(true);
    expect(isRuleFormValid(form, [{ from: 5, to: null, rate: 3 }])).toBe(false);
  });

  it('refuses a validity that ends before it starts and a priority below one', () => {
    const form = { ...DEFAULT_RULE_FORM, name: 'R', rate: 5 };

    expect(isRuleFormValid({ ...form, valid_from: '2026-05-01', valid_to: '2026-04-01' }, [])).toBe(
      false,
    );
    expect(isRuleFormValid({ ...form, priority: 0 }, [])).toBe(false);
  });

  it('builds the payload of a percentage rule with its rate, without tiers', () => {
    const payload = rulePayloadOf(
      { ...DEFAULT_RULE_FORM, name: ' Wine ', rate: 7.5, customer_id: 'c-1' },
      [],
    );

    expect(payload).toMatchObject({
      name: 'Wine',
      rate_type: 'percentage',
      rate: 7.5,
      fixed_amount: null,
      customer_id: 'c-1',
      priority: 100,
      valid_from: null,
      tiers: [],
    });
  });

  it('sends the tiers of a progressive rule and the amount of a fixed one', () => {
    const tiered = rulePayloadOf({ ...DEFAULT_RULE_FORM, name: 'T' }, [
      { from: 0, to: 1000, rate: 2 },
      { from: 1000, to: null, rate: 4 },
    ]);
    expect(tiered.tiers).toEqual([
      { threshold_from: 0, threshold_to: 1000, rate: 2 },
      { threshold_from: 1000, threshold_to: null, rate: 4 },
    ]);

    const fixed = rulePayloadOf(
      { ...DEFAULT_RULE_FORM, name: 'F', rate_type: 'fixed', fixed_amount: 30 },
      [{ from: 0, to: null, rate: 3 }],
    );
    expect(fixed.fixed_amount).toBe(30);
    expect(fixed.rate).toBe(0);
    expect(fixed.tiers).toEqual([]);
  });

  it('reads a rule back into the form', () => {
    const form = ruleFormOf(
      rule('r-1', { rate: '7.5000', valid_to: '2026-12-31', accrual_basis: 'collected' }),
    );

    expect(form.rate).toBe(7.5);
    expect(form.valid_to).toBe('2026-12-31');
    expect(form.accrual_basis).toBe('collected');
    expect(form.fixed_amount).toBeNull();
  });

  it('names a dimension, or leaves it open', () => {
    const names = new Map([['c-1', 'Acme']]);

    expect(dimensionName(null, names)).toBeNull();
    expect(dimensionName('c-1', names)).toBe('Acme');
    expect(dimensionName('c-2-unknown-id', names)).toBe('c-2-unkn');
  });
});

describe('fiscal parameters', () => {
  it('validates the FIRR brackets: increasing ceilings, only the last open, rates up to 100', () => {
    expect(bracketsAreValid([])).toBe(false);
    expect(
      bracketsAreValid([
        { from: null, to: 12500, rate: 4 },
        { from: null, to: 20000, rate: 2 },
        { from: null, to: null, rate: 0 },
      ]),
    ).toBe(true);
    expect(
      bracketsAreValid([
        { from: null, to: 20000, rate: 4 },
        { from: null, to: 12500, rate: 2 },
      ]),
    ).toBe(false);
    expect(
      bracketsAreValid([
        { from: null, to: null, rate: 4 },
        { from: null, to: 12500, rate: 2 },
      ]),
    ).toBe(false);
    expect(bracketsAreValid([{ from: null, to: 1000, rate: 101 }])).toBe(false);
  });

  it('builds the bracket payload with the ceiling and the rate', () => {
    expect(
      bracketPayloadOf([
        { from: null, to: 12500, rate: 4 },
        { from: null, to: null, rate: 0 },
      ]),
    ).toEqual([
      { up_to: 12500, rate: 4 },
      { up_to: null, rate: 0 },
    ]);
  });

  it('keeps a percentage up to 100 and an amount free', () => {
    expect(isParameterValueValid('vat_rate', 22)).toBe(true);
    expect(isParameterValueValid('vat_rate', 101)).toBe(false);
    expect(isParameterValueValid('withholding_base_with_organization', 100)).toBe(true);
    expect(isParameterValueValid('withholding_base_with_organization', 100.5)).toBe(false);
    expect(isParameterValueValid('enasarco_massimale', 45000)).toBe(true);
    expect(isParameterValueValid('enasarco_massimale', -1)).toBe(false);
    expect(isParameterValueValid('enasarco_massimale', null)).toBe(false);
  });

  it('overrides a row with the same code, mandate and year', () => {
    const row = { code: 'enasarco_massimale', mandate_type: 'multi', year: 2026 } as const;

    expect(fiscalOverrideOf(row, 45000, [])).toEqual({
      code: 'enasarco_massimale',
      mandate_type: 'multi',
      year: 2026,
      value: 45000,
      payload: null,
    });
    expect(
      fiscalOverrideOf({ code: 'firr_brackets', mandate_type: 'single', year: 2026 }, 3, [
        { from: null, to: null, rate: 4 },
      ]),
    ).toEqual({
      code: 'firr_brackets',
      mandate_type: 'single',
      year: 2026,
      value: null,
      payload: [{ up_to: null, rate: 4 }],
    });
    expect(
      isFiscalFormValid({ code: 'firr_brackets' }, null, [{ from: null, to: null, rate: 4 }]),
    ).toBe(true);
    expect(isFiscalFormValid({ code: 'vat_rate' }, null, [])).toBe(false);
  });
});

describe('zones', () => {
  it('parses regions: trimmed, upper-cased and listed once', () => {
    expect(parseRegions('mi, to ,TI;mi')).toEqual(['MI', 'TO', 'TI']);
    expect(parseRegions('')).toEqual([]);
  });

  it('needs a code and a name, and a country of two letters when given', () => {
    expect(isZoneFormValid(DEFAULT_ZONE_FORM)).toBe(false);
    expect(isZoneFormValid({ ...DEFAULT_ZONE_FORM, code: 'N', name: 'North' })).toBe(true);
    expect(
      isZoneFormValid({ ...DEFAULT_ZONE_FORM, code: 'N', name: 'North', country: 'ITA' }),
    ).toBe(false);
  });

  it('builds the payload and reads a zone back', () => {
    expect(
      zonePayloadOf({
        code: ' N ',
        name: ' North ',
        country: 'it',
        regions: 'mi, to',
        is_active: true,
      }),
    ).toEqual({ code: 'N', name: 'North', country: 'IT', regions: ['MI', 'TO'], is_active: true });
    expect(zonePayloadOf({ ...DEFAULT_ZONE_FORM, code: 'N', name: 'North' }).country).toBeNull();
    expect(zoneFormOf(zone('1'))).toMatchObject({ code: 'Z1', country: 'IT', regions: 'MI, TO' });
  });
});

describe('statement periods', () => {
  it('computes the bounds of a month, including leap years', () => {
    expect(monthBounds('2026-03')).toEqual({ start: '2026-03-01', end: '2026-03-31' });
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthBounds('2026-13')).toBeNull();
    expect(monthBounds('')).toBeNull();
  });

  it('computes the bounds of a quarter', () => {
    expect(quarterBounds(2026, 1)).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect(quarterBounds(2026, 4)).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    expect(quarterBounds(2026, 5)).toBeNull();
  });

  it('resolves the period of the dialog for each type', () => {
    const base = {
      type: 'monthly' as const,
      month: '2026-03',
      year: 2026,
      quarter: 2,
      from: '',
      to: '',
    };

    expect(periodOf(base)).toEqual({ start: '2026-03-01', end: '2026-03-31' });
    expect(periodOf({ ...base, type: 'quarterly' })).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
    });
    expect(periodOf({ ...base, type: 'custom', from: '2026-02-10', to: '2026-02-20' })).toEqual({
      start: '2026-02-10',
      end: '2026-02-20',
    });
  });

  it('refuses an incomplete period, an end before the start and a period over two years', () => {
    const base = { type: 'custom' as const, month: '', year: 2026, quarter: 1, from: '', to: '' };

    expect(periodOf(base)).toBeNull();
    expect(periodOf({ ...base, from: '2026-03-10', to: '2026-03-01' })).toBeNull();
    expect(periodOf({ ...base, from: '2025-12-15', to: '2026-01-15' })).toBeNull();
    expect(periodOf({ ...base, type: 'monthly', month: 'bad' })).toBeNull();
  });

  it('knows the current month, quarter and date', () => {
    const now = new Date(2026, 4, 9);

    expect(currentMonth(now)).toBe('2026-05');
    expect(currentQuarter(now)).toBe(2);
    expect(todayParam(now)).toBe('2026-05-09');
    expect(selectableYears(now)).toEqual([2026, 2025, 2024, 2023, 2022]);
  });
});

describe('statement summary', () => {
  it('reads the figures of a saved statement', () => {
    const view = summaryOfStatement(statement('1'));

    expect(view.gross_commission).toBe('500.00');
    expect(view.firr).toBe('20.00');
    expect(view.withholding).toBe('48.65');
    expect(view.vat_amount).toBe('110.00');
    expect(view.lines_count).toBe(1);
  });

  it('reads the figures of a preview from its fiscal breakdown', () => {
    const view = summaryOfPreview(preview);

    expect(view.gross_commission).toBe('550.00');
    expect(view.enasarco_agent).toBe('14.85');
    expect(view.vat_amount).toBe('121.00');
    expect(view.net_payable).toBe('632.63');
    expect(view.massimale_reached).toBe(true);
    expect(view.lines_count).toBe(3);
  });
});

describe('numbers and file names', () => {
  it('formats a rate without trailing zeros', () => {
    expect(formatRate('12.5000')).toBe('12.5%');
    expect(formatRate(7)).toBe('7%');
    expect(formatRate(null)).toBe('');
    expect(formatRate('')).toBe('');
  });

  it('computes the share of the ceiling used, capped at 100', () => {
    expect(progressPercent('20000.00', '40000.00')).toBe(50);
    expect(progressPercent('50000.00', '40000.00')).toBe(100);
    expect(progressPercent('0.00', '40000.00')).toBe(0);
    expect(progressPercent('100.00', null)).toBe(0);
  });

  it('tells a non-zero amount and a range', () => {
    expect(isNonZero('0.00')).toBe(false);
    expect(isNonZero('-0.01')).toBe(true);
    expect(isNonZero(null)).toBe(false);
    expect(inRange(5, 0, 100)).toBe(true);
    expect(inRange(null, 0, 100)).toBe(false);
  });

  it('names the downloads like the API does', () => {
    expect(statementFileName('ST-2026-0001')).toBe('statement-ST-2026-0001.pdf');
    expect(cuFileName(2026)).toBe('cu-agents-2026.csv');
    expect(enasarcoFileName(2026)).toBe('enasarco-2026.csv');
    expect(enasarcoFileName(2026, 3)).toBe('enasarco-2026-q3.csv');
  });
});
