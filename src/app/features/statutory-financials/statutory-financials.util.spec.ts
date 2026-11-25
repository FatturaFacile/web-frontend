import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { SfDossier, SfIssue, SfLine, SfNarrativeSection, SfStandardLookup } from '@core';
import {
  allowedIncomeMethods,
  buildDossierPayload,
  buildMinutesPayload,
  buildTree,
  canDelete,
  cleanWhatIf,
  draftFromDossier,
  emptyDraft,
  emptyMinutesDraft,
  emptyNotesRow,
  errorKey,
  failureOf,
  flattenTree,
  formatAmount,
  groupIssues,
  hasRounding,
  indicatorValueText,
  isDecimal,
  isEditable,
  isFallback,
  isLocked,
  isWhatIfEmpty,
  jurisdictionOf,
  labelTitle,
  lifecycleActions,
  minutesProblem,
  percentText,
  removeRow,
  roundDecimal,
  roundingLines,
  rowsAreValid,
  scaleOfMode,
  shortSha,
  signOf,
  sizeText,
  statementRows,
  statusColor,
  statusStepIndex,
  tabOfUrl,
  toInputNumber,
  toIsoDate,
  updateRow,
  validationColor,
  visibleNarrativeSections,
  visibleNotesTables,
  wizardProblem,
} from './statutory-financials.util';

function line(
  code: string,
  level: number,
  parent: string | null,
  extra: Partial<SfLine> = {},
): SfLine {
  return {
    code,
    parent_code: parent,
    sign: 1,
    side: 'asset',
    sort_order: 0,
    level,
    is_leaf: false,
    is_total: false,
    is_rounding: false,
    xbrl_element: null,
    amount: '0.0000',
    exact_amount: '0.0000',
    comparative_amount: null,
    label: code,
    ...extra,
  };
}

describe('amount formatting by jurisdiction', () => {
  it('formats Italian amounts as 1.234,56', () => {
    expect(formatAmount('1234.5600', 'IT', 2)).toBe('1.234,56');
    expect(formatAmount('1234567.891', 'IT', 2)).toBe('1.234.567,89');
    expect(formatAmount('0.5', 'IT', 2)).toBe('0,50');
  });

  it("formats Swiss amounts as 1'234.56", () => {
    expect(formatAmount('1234.5600', 'CH', 2)).toBe("1'234.56");
    expect(formatAmount('1234567.891', 'CH', 2)).toBe("1'234'567.89");
  });

  it('rounds half away from zero to whole units without floats', () => {
    expect(formatAmount('1234.5', 'IT', 0)).toBe('1.235');
    expect(formatAmount('1234.49', 'IT', 0)).toBe('1.234');
    expect(formatAmount('-1234.5', 'CH', 0)).toBe("-1'235");
    expect(formatAmount('999.995', 'IT', 2)).toBe('1.000,00');
  });

  it('keeps the precision a float would lose', () => {
    expect(formatAmount('12345678901234567.89', 'IT', 2)).toBe('12.345.678.901.234.567,89');
    expect(formatAmount('0.1', 'CH', 2)).toBe('0.10');
  });

  it('shows negative amounts with a sign and never negative zero', () => {
    expect(formatAmount('-1234.5600', 'IT', 2)).toBe('-1.234,56');
    expect(formatAmount('-0.004', 'IT', 2)).toBe('0,00');
  });

  it('gives an empty text for an empty or malformed value', () => {
    expect(formatAmount(null, 'IT')).toBe('');
    expect(formatAmount(undefined, 'IT')).toBe('');
    expect(formatAmount('', 'IT')).toBe('');
    expect(formatAmount('abc', 'IT')).toBe('');
  });

  it('formats percentages and indicator values by unit', () => {
    expect(percentText('12.3456')).toBe('12.35%');
    expect(percentText(null)).toBe('');
    expect(indicatorValueText('12.5', 'percent', 'IT')).toBe('12.50%');
    expect(indicatorValueText('1234.5', 'amount', 'CH')).toBe("1'234.50");
    expect(indicatorValueText(null, 'ratio', 'IT')).toBe('');
  });

  it('rounds a decimal string and reads signs', () => {
    expect(roundDecimal('2.675', 2)).toEqual({ negative: false, digits: '268' });
    expect(roundDecimal('x', 2)).toBeNull();
    expect(signOf('-3.2')).toBe(-1);
    expect(signOf('0.0000')).toBe(0);
    expect(signOf('4')).toBe(1);
    expect(signOf(null)).toBe(0);
  });

  it('validates decimal input and turns it into a control number', () => {
    expect(isDecimal('12.50')).toBe(true);
    expect(isDecimal('-3')).toBe(true);
    expect(isDecimal('1,5')).toBe(false);
    expect(isDecimal('')).toBe(false);
    expect(toInputNumber('12.5')).toBe(12.5);
    expect(toInputNumber(null)).toBeNull();
    expect(toInputNumber('x')).toBeNull();
  });

  it('derives the scale from the rounding mode and the jurisdiction from the standard', () => {
    expect(scaleOfMode('IntegerUnits_Euro_Chf')).toBe(0);
    expect(scaleOfMode('ExactCents')).toBe(2);
    expect(jurisdictionOf('CH_SwissGaapFer')).toBe('CH');
    expect(jurisdictionOf('CH_CO_Art959')).toBe('CH');
    expect(jurisdictionOf('IT_OIC_Micro')).toBe('IT');
    expect(jurisdictionOf(null)).toBe('IT');
  });
});

describe('statement tree', () => {
  const lines = [
    line('A', 0, null),
    line('A.I', 1, 'A'),
    line('A.I.1', 2, 'A.I', { is_leaf: true }),
    line('A.I.2', 2, 'A.I', { is_leaf: true }),
    line('A.II', 1, 'A', { is_leaf: true }),
    line('B', 0, null, { is_total: true }),
  ];

  it('builds the tree from parent_code', () => {
    const roots = buildTree(lines);
    expect(roots.map((node) => node.line.code)).toEqual(['A', 'B']);
    expect(roots[0]?.children.map((node) => node.line.code)).toEqual(['A.I', 'A.II']);
    expect(roots[0]?.children[0]?.children).toHaveLength(2);
    expect(roots[0]?.children[0]?.children[0]?.depth).toBe(2);
  });

  it('falls back to the level when a line has no parent_code', () => {
    const flat = [
      line('X', 0, null),
      line('X1', 1, null),
      line('X11', 2, null),
      line('X2', 1, null),
      line('Y', 0, null),
    ];
    const rows = statementRows(flat);
    expect(rows.map((row) => [row.line.code, row.depth])).toEqual([
      ['X', 0],
      ['X1', 1],
      ['X11', 2],
      ['X2', 1],
      ['Y', 0],
    ]);
  });

  it('flattens depth first and marks the rows that have children', () => {
    const rows = flattenTree(buildTree(lines));
    expect(rows.map((row) => row.line.code)).toEqual(['A', 'A.I', 'A.I.1', 'A.I.2', 'A.II', 'B']);
    expect(rows.find((row) => row.line.code === 'A.I')?.hasChildren).toBe(true);
    expect(rows.find((row) => row.line.code === 'A.II')?.hasChildren).toBe(false);
  });

  it('leaves out the children of a collapsed line', () => {
    const rows = statementRows(lines, new Set(['A.I']));
    expect(rows.map((row) => row.line.code)).toEqual(['A', 'A.I', 'A.II', 'B']);
  });

  it('treats an unknown parent_code as a root', () => {
    const rows = statementRows([line('Z', 3, 'MISSING')]);
    expect(rows[0]?.depth).toBe(0);
  });
});

describe('rounding lines', () => {
  const lines = [
    line('E', 0, null),
    line('E.R', 1, 'E', { is_rounding: true }),
    line('F', 0, null, { is_rounding: true }),
  ];

  it('detects the lines that only round the statement', () => {
    expect(roundingLines(lines).map((entry) => entry.code)).toEqual(['E.R', 'F']);
    expect(hasRounding(lines)).toBe(true);
    expect(hasRounding([line('E', 0, null)])).toBe(false);
  });
});

describe('status, colours and lifecycle', () => {
  it('colours statuses and validations', () => {
    expect(statusColor('validated')).toBe('green');
    expect(statusColor('draft')).toBe('default');
    expect(validationColor('invalid')).toBe('red');
    expect(validationColor('warnings')).toBe('orange');
    expect(validationColor(null)).toBe('default');
    expect(statusStepIndex('draft')).toBe(0);
    expect(statusStepIndex('filed')).toBe(5);
  });

  it('locks and files only a locked or filed dossier read-only', () => {
    expect(isLocked('locked')).toBe(true);
    expect(isLocked('filed')).toBe(true);
    expect(isLocked('validated')).toBe(false);
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('filed')).toBe(false);
    expect(isEditable(null)).toBe(false);
    expect(canDelete('validated')).toBe(true);
    expect(canDelete('locked')).toBe(false);
  });

  it('enables lock from validated, reopen and file from locked, with a tooltip otherwise', () => {
    const byName = (status: Parameters<typeof lifecycleActions>[0]) =>
      Object.fromEntries(lifecycleActions(status).map((action) => [action.name, action]));

    expect(byName('validated')['lock']?.enabled).toBe(true);
    expect(byName('validated')['lock']?.target).toBe('locked');
    expect(byName('validated')['reopen']?.enabled).toBe(false);
    expect(byName('validated')['reopen']?.hintKey).toBe(
      'statutoryFinancials.hint.reopenRequiresLocked',
    );
    expect(byName('draft')['lock']?.enabled).toBe(false);
    expect(byName('draft')['lock']?.hintKey).toBe('statutoryFinancials.hint.lockRequiresValidated');
    expect(byName('locked')['reopen']?.enabled).toBe(true);
    expect(byName('locked')['reopen']?.target).toBe('draft');
    expect(byName('locked')['file']?.enabled).toBe(true);
    expect(byName('locked')['file']?.target).toBe('filed');
    expect(byName('locked')['lock']?.enabled).toBe(false);
    expect(byName('filed')['file']?.enabled).toBe(false);
    expect(byName('filed')['file']?.hintKey).toBe('statutoryFinancials.hint.fileRequiresLocked');
  });
});

describe('errors', () => {
  it('maps the problem code to a translation key', () => {
    expect(errorKey('dossier_locked')).toBe('statutoryFinancials.error.dossier_locked');
    expect(errorKey(undefined)).toBe('statutoryFinancials.error.generic');
  });

  it('reads the code, the params and the first field error of a problem', () => {
    const failure = failureOf(
      new HttpErrorResponse({
        status: 409,
        error: { code: 'transition_not_allowed', params: { from: 'draft' } },
      }),
    );
    expect(failure).toMatchObject({
      ok: false,
      errorKey: 'statutoryFinancials.error.transition_not_allowed',
      params: { from: 'draft' },
    });

    const invalid = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { detail: 'Invalid.', errors: { title: ['Too long.'] } },
      }),
    );
    expect(invalid.detail).toBe('Too long.');
    expect(invalid.errors).toEqual({ title: ['Too long.'] });
  });

  it('falls back to the generic key when the failure is not a problem', () => {
    expect(failureOf(new Error('boom')).errorKey).toBe('statutoryFinancials.error.generic');
  });
});

describe('validation issues', () => {
  const issue = (category: SfIssue['category'], code: string): SfIssue => ({
    severity: 'error',
    category,
    code,
    params: {},
    message: code,
  });

  it('groups the issues by category in the order of the categories and drops the empty ones', () => {
    const groups = groupIssues([
      issue('notes', 'n1'),
      issue('schema', 's1'),
      issue('notes', 'n2'),
      issue('reclassification', 'r1'),
    ]);
    expect(groups.map((group) => group.category)).toEqual(['schema', 'notes', 'reclassification']);
    expect(groups[1]?.issues.map((entry) => entry.code)).toEqual(['n1', 'n2']);
  });

  it('shortens hashes and sizes', () => {
    expect(shortSha('a'.repeat(64))).toBe('a'.repeat(12));
    expect(shortSha(null)).toBe('');
    expect(sizeText(512)).toBe('512 B');
    expect(sizeText(2048)).toBe('2.0 KB');
    expect(sizeText(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('what-if payload', () => {
  it('drops empty, null and unknown parameters', () => {
    const cleaned = cleanWhatIf({
      ebitda_change_percent: -10,
      revenue_change_percent: null,
      extra_liquidity: 0,
      unknown: 5,
    } as never);
    expect(cleaned).toEqual({ ebitda_change_percent: -10, extra_liquidity: 0 });
  });

  it('knows when nothing is left to simulate', () => {
    expect(isWhatIfEmpty({})).toBe(true);
    expect(isWhatIfEmpty({ revenue_change_percent: null })).toBe(true);
    expect(isWhatIfEmpty({ debt_service_change_percent: 5 })).toBe(false);
  });
});

describe('wizard', () => {
  const standard = (methods: SfStandardLookup['income_statement_methods']): SfStandardLookup =>
    ({ income_statement_methods: methods }) as SfStandardLookup;

  it('limits the income statement methods to what the standard allows', () => {
    expect(allowedIncomeMethods(standard(['total_cost']))).toEqual(['total_cost']);
    expect(allowedIncomeMethods(undefined)).toEqual(['total_cost', 'cost_of_sales']);
  });

  it('validates each step', () => {
    const draft = emptyDraft();
    expect(wizardProblem(0, draft)).toBe('fiscal_year_required');

    draft.fiscal_year_id = 'fy-1';
    draft.comparative_prior_year_id = 'fy-1';
    expect(wizardProblem(0, draft)).toBe('comparative_same');

    draft.comparative_prior_year_id = 'fy-0';
    expect(wizardProblem(0, draft)).toBeNull();

    expect(wizardProblem(1, draft)).toBe('standard_required');
    draft.accounting_standard = 'IT_OIC_Ordinario';
    draft.income_statement_method = 'cost_of_sales';
    draft.cogs_depr = 120;
    expect(wizardProblem(1, draft)).toBe('cogs_allocation_invalid');
    draft.cogs_depr = 40;
    expect(wizardProblem(1, draft)).toBeNull();

    expect(wizardProblem(2, draft)).toBeNull();
  });

  it('requires complete hidden reserve items only for an enabled Swiss standard', () => {
    const draft = {
      ...emptyDraft(),
      accounting_standard: 'CH_SwissGaapFer' as const,
      hidden_enabled: true,
    };
    draft.hidden_items = [{ label: '', book_value: 10, fer_value: 20 }];
    expect(wizardProblem(3, draft)).toBe('hidden_item_invalid');

    draft.hidden_items = [{ label: 'Stock', book_value: 10, fer_value: 20 }];
    expect(wizardProblem(3, draft)).toBeNull();

    expect(wizardProblem(3, { ...draft, accounting_standard: 'IT_OIC_Ordinario' })).toBeNull();
  });

  it('builds the payload with the cost of sales allocation only for that method', () => {
    const draft = {
      ...emptyDraft(),
      fiscal_year_id: 'fy-1',
      title: '  Annual accounts  ',
      accounting_standard: 'IT_OIC_Ordinario' as const,
      income_statement_method: 'cost_of_sales' as const,
      cogs_personnel: 30,
      cogs_depr: 50,
      share_capital: 10000,
      dividends: 500,
    };
    const payload = buildDossierPayload(draft);

    expect(payload).toMatchObject({
      fiscal_year_id: 'fy-1',
      comparative_prior_year_id: null,
      title: 'Annual accounts',
      accounting_standard: 'IT_OIC_Ordinario',
      rounding_to_unit_mode: 'ExactCents',
      income_statement_method: 'cost_of_sales',
      cash_flow_method: 'indirect',
      options: { cogs_allocation: { personnel: 30, depr: 50 } },
      share_capital: 10000,
      dividends: 500,
    });
    expect(payload.hidden_reserves_config).toBeUndefined();
    expect(payload.other_reserves).toBeUndefined();

    expect(
      buildDossierPayload({ ...draft, income_statement_method: 'total_cost' }).options,
    ).toBeUndefined();
  });

  it('sends the hidden reserves config for the Swiss standards, items only when enabled', () => {
    const base = {
      ...emptyDraft(),
      fiscal_year_id: 'fy-1',
      accounting_standard: 'CH_SwissGaapFer' as const,
      hidden_enabled: true,
      hidden_tax_rate_percent: 12.5,
      hidden_items: [{ label: ' Stock ', book_value: 100, fer_value: 160 }],
    };
    expect(buildDossierPayload(base).hidden_reserves_config).toEqual({
      enabled: true,
      tax_rate_percent: 12.5,
      reserves_created: undefined,
      reserves_released: undefined,
      items: [{ label: 'Stock', book_value: '100', fer_value: '160' }],
    });
    expect(
      buildDossierPayload({ ...base, hidden_enabled: false }).hidden_reserves_config?.items,
    ).toEqual([]);
  });

  it('prefills the draft from an existing dossier', () => {
    const dossier = {
      title: 'Accounts 2025',
      fiscal_year_id: 'fy-1',
      comparative_prior_year_id: 'fy-0',
      accounting_standard: 'CH_CO_Art959',
      rounding_to_unit_mode: 'IntegerUnits_Euro_Chf',
      income_statement_method: 'cost_of_sales',
      cash_flow_method: 'direct',
      share_capital: '100000.0000',
      options: { cogs_allocation: { personnel: 25 } },
      profit_allocation_proposal: {
        dividends: '200.0000',
        other_reserves: '0.0000',
        carried_forward_out: '50.0000',
      },
      hidden_reserves_config: {
        enabled: true,
        tax_rate_percent: '12.5',
        items: [{ label: 'Land', book_value: '1', fer_value: '2' }],
      },
    } as unknown as SfDossier;

    const draft = draftFromDossier(dossier);
    expect(draft).toMatchObject({
      title: 'Accounts 2025',
      accounting_standard: 'CH_CO_Art959',
      rounding_to_unit_mode: 'IntegerUnits_Euro_Chf',
      cogs_personnel: 25,
      share_capital: 100000,
      dividends: 200,
      carried_forward: 50,
      hidden_enabled: true,
      hidden_tax_rate_percent: 12.5,
      hidden_items: [{ label: 'Land', book_value: 1, fer_value: 2 }],
    });
  });
});

describe('notes', () => {
  const standard = {
    notes: {
      tables: ['equity', 'unknown', 'maturity', 'fixed_assets'],
      sections: ['accounting_policies', 'missing', 'intro'],
    },
  } as unknown as SfStandardLookup;
  const section = (key: string): SfNarrativeSection => ({
    key,
    title: key,
    body: key,
    edited: false,
  });

  it('shows only the tables the standard lists, in its order', () => {
    expect(visibleNotesTables(standard)).toEqual(['equity', 'maturity', 'fixed_assets']);
    expect(visibleNotesTables(undefined)).toHaveLength(9);
  });

  it('shows only the narrative sections the standard lists, in its order', () => {
    const sections = [section('intro'), section('accounting_policies'), section('other')];
    expect(visibleNarrativeSections(standard, sections).map((entry) => entry.key)).toEqual([
      'accounting_policies',
      'intro',
    ]);
    expect(visibleNarrativeSections(undefined, sections)).toHaveLength(3);
  });

  it('edits a row without touching the others or the source', () => {
    const rows = [{ amount: '1' }, { amount: '2' }];
    const next = updateRow(rows, 1, 'amount', '5');
    expect(next).toEqual([{ amount: '1' }, { amount: '5' }]);
    expect(rows[1]).toEqual({ amount: '2' });
    expect(removeRow(rows, 0)).toEqual([{ amount: '2' }]);
  });

  it('creates an empty row with zero decimals and the first option of a select', () => {
    expect(emptyNotesRow('off_balance')).toEqual({ type: '', description: '', amount: '0' });
    expect(emptyNotesRow('taxes')).toEqual({ kind: 'current', amount: '0' });
  });

  it('blocks rows with an invalid decimal', () => {
    expect(rowsAreValid('off_balance', [{ type: 'a', description: 'b', amount: '10.5' }])).toBe(
      true,
    );
    expect(rowsAreValid('off_balance', [{ type: 'a', description: 'b', amount: '10,5' }])).toBe(
      false,
    );
    expect(rowsAreValid('off_balance', [])).toBe(true);
  });

  it('detects the fallback badge', () => {
    expect(isFallback({ fallback: true })).toBe(true);
    expect(isFallback({ fallback: false })).toBe(false);
    expect(isFallback(null)).toBe(false);
  });
});

describe('routing, labels and minutes', () => {
  it('finds the tab of a workspace url', () => {
    expect(tabOfUrl('/statutory-financials/d-1/notes')).toBe('notes');
    expect(tabOfUrl('/statutory-financials/d-1/package?x=1')).toBe('package');
    expect(tabOfUrl('/statutory-financials/d-1')).toBe('statements');
  });

  it('reads a seeded label title', () => {
    const labels = { 'report.balance_sheet': { title: 'Stato patrimoniale', body: '' } };
    expect(labelTitle(labels, 'report.balance_sheet')).toBe('Stato patrimoniale');
    expect(labelTitle(labels, 'missing')).toBe('');
    expect(labelTitle(null, 'x')).toBe('');
  });

  it('formats a calendar date in the local time zone', () => {
    expect(toIsoDate(new Date(2026, 2, 5))).toBe('2026-03-05');
    expect(toIsoDate(null)).toBeNull();
  });

  it('validates the minutes steps', () => {
    const draft = emptyMinutesDraft();
    draft.board = false;
    expect(minutesProblem(0, draft)).toBe('kind_required');
    draft.shareholders = true;
    expect(minutesProblem(0, draft)).toBeNull();
    expect(minutesProblem(1, draft)).toBe('date_required');
    draft.meeting_date = new Date(2026, 5, 30);
    expect(minutesProblem(1, draft)).toBeNull();
  });

  it('builds the minutes payload with only the filled meeting fields', () => {
    const draft = {
      ...emptyMinutesDraft(),
      board: true,
      shareholders: true,
      meeting_date: new Date(2026, 5, 30),
      chair: ' A. Rossi ',
      attendees: ['A. Rossi', ' ', 'B. Bianchi'],
    };
    expect(buildMinutesPayload(draft)).toEqual({
      kinds: ['board_minutes', 'shareholders_minutes'],
      meeting: {
        meeting_date: '2026-06-30',
        chair: 'A. Rossi',
        attendees: ['A. Rossi', 'B. Bianchi'],
      },
    });
    expect(buildMinutesPayload({ ...emptyMinutesDraft() })).toEqual({ kinds: ['board_minutes'] });
  });
});
