import { describe, expect, it } from 'vitest';
import {
  autofillRemainder,
  computeTotals,
  emptyLine,
  isBalanced,
  PrimaNotaLine,
  resolveShortcut,
  searchAccounts,
  toCents,
  toLinePayloads,
  validateLines,
} from './prima-nota.util';

function line(key: number, patch: Partial<PrimaNotaLine> = {}): PrimaNotaLine {
  return { ...emptyLine(key), ...patch };
}

const key = (event: Partial<Parameters<typeof resolveShortcut>[0]>) =>
  resolveShortcut({
    key: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...event,
  });

describe('prima nota util', () => {
  describe('toCents', () => {
    it.each([
      ['100', 10000],
      ['1.234,56', 123456],
      ['1,234.56', 123456],
      ['12,5', 1250],
      ['0.1', 10],
      ['', 0],
      ['abc', 0],
      ['-5', 0],
    ])('parses %s as %i cents', (input, cents) => {
      expect(toCents(input)).toBe(cents);
    });

    it('does not drift on floating point sums', () => {
      const totals = computeTotals([
        line(1, { debit: '0.1' }),
        line(2, { debit: '0.2' }),
        line(3, { credit: '0.30' }),
      ]);
      expect(totals.differenceCents).toBe(0);
      expect(isBalanced(totals)).toBe(true);
    });
  });

  describe('autofillRemainder', () => {
    it('puts the missing credit on the last empty line', () => {
      const lines = autofillRemainder(
        [line(1, { accountId: 'a', debit: '100' }), line(2, { accountId: 'b' })],
        null,
        3,
      );
      expect(lines[1].credit).toBe('100.00');
      expect(lines[1].debit).toBe('');
      expect(isBalanced(computeTotals(lines))).toBe(true);
    });

    it('puts the missing debit on the given line, replacing its own amount', () => {
      const lines = autofillRemainder([line(1, { credit: '70' }), line(2, { debit: '10' })], 2, 3);
      expect(lines[1].debit).toBe('70.00');
    });

    it('appends a line when none is free', () => {
      const lines = autofillRemainder([line(1, { debit: '5' }), line(2, { debit: '5' })], null, 3);
      expect(lines).toHaveLength(3);
      expect(lines[2].credit).toBe('10.00');
    });

    it('clears the line when already balanced', () => {
      const lines = autofillRemainder(
        [line(1, { debit: '5' }), line(2, { credit: '5' }), line(3)],
        null,
        4,
      );
      expect(lines[2].debit).toBe('');
      expect(lines[2].credit).toBe('');
    });
  });

  describe('validateLines', () => {
    const ok = [
      line(1, { accountId: 'a', debit: '10' }),
      line(2, { accountId: 'b', credit: '10' }),
    ];

    it('accepts a balanced entry', () => {
      expect(validateLines('Rent', ok)).toEqual([]);
    });

    it('blocks an unbalanced entry', () => {
      const issues = validateLines('Rent', [
        line(1, { accountId: 'a', debit: '10' }),
        line(2, { accountId: 'b', credit: '9.99' }),
      ]);
      expect(issues).toEqual(['unbalanced']);
    });

    it('requires a description, two lines and an account on every used line', () => {
      expect(validateLines(' ', ok)).toContain('description_required');
      expect(validateLines('x', [ok[0]])).toContain('min_lines');
      expect(validateLines('x', [ok[0], line(2, { debit: '0', credit: '10' })])).toContain(
        'account_required',
      );
    });

    it('rejects a line with both sides', () => {
      expect(
        validateLines('x', [line(1, { accountId: 'a', debit: '5', credit: '5' }), ok[1]]),
      ).toContain('both_sides');
    });

    it('ignores empty lines and an entry without amounts', () => {
      expect(validateLines('x', [line(1), line(2)])).toContain('nothing_to_post');
      expect(validateLines('Rent', [...ok, line(3)])).toEqual([]);
    });
  });

  it('builds the line payloads without the empty lines', () => {
    const payloads = toLinePayloads([
      line(1, { accountId: 'a', debit: '10,5', description: ' rent ' }),
      line(2),
    ]);
    expect(payloads).toEqual([
      {
        account_id: 'a',
        debit_amount: 10.5,
        credit_amount: 0,
        description: 'rent',
        cost_center_id: null,
      },
    ]);
  });

  it('validates and includes paired competence dates on line payloads', () => {
    expect(
      validateLines('Insurance', [
        line(1, { accountId: 'a', debit: '100', competenceStartDate: '2026-10-01' }),
        line(2, { accountId: 'b', credit: '100' }),
      ]),
    ).toContain('competence_incomplete');

    expect(
      validateLines('Insurance', [
        line(1, {
          accountId: 'a',
          debit: '100',
          competenceStartDate: '2027-09-30',
          competenceEndDate: '2026-10-01',
        }),
        line(2, { accountId: 'b', credit: '100' }),
      ]),
    ).toContain('competence_inverted');

    const payloads = toLinePayloads([
      line(1, {
        accountId: 'a',
        debit: '1200',
        competenceStartDate: '2026-10-01',
        competenceEndDate: '2027-09-30',
      }),
    ]);
    expect(payloads[0]).toMatchObject({
      competence_start_date: '2026-10-01',
      competence_end_date: '2027-09-30',
    });
  });

  describe('searchAccounts', () => {
    const accounts = [
      { account_code: '1000', name: 'Cassa' },
      { account_code: '6000', name: 'Affitti passivi' },
      { account_code: '2000', name: 'Debiti verso fornitori' },
      { account_code: '4000', name: 'Ricavi 1000 servizi' },
    ];

    it('matches the code prefix first, then the code or name containing the text', () => {
      expect(searchAccounts(accounts, '1000').map((a) => a.account_code)).toEqual(['1000', '4000']);
      expect(searchAccounts(accounts, 'affitti').map((a) => a.account_code)).toEqual(['6000']);
    });

    it('ignores case and accents and returns the first accounts for an empty query', () => {
      expect(
        searchAccounts([{ account_code: '7', name: 'Perdite su crédito' }], 'CREDITO'),
      ).toHaveLength(1);
      expect(searchAccounts(accounts, '', 2)).toHaveLength(2);
    });
  });

  describe('resolveShortcut', () => {
    it('maps the workbench keys', () => {
      expect(key({ key: 'n', altKey: true })).toBe('add_line');
      expect(key({ key: 'B', altKey: true })).toBe('balance');
      expect(key({ key: 'l', altKey: true })).toBe('next_ledger');
      expect(key({ key: 't', altKey: true })).toBe('focus_template');
      expect(key({ key: 's', ctrlKey: true })).toBe('save_draft');
      expect(key({ key: 'Enter', ctrlKey: true })).toBe('post');
      expect(key({ key: 'Enter', metaKey: true })).toBe('post');
    });

    it('ignores plain keys and other combinations', () => {
      expect(key({ key: 'n' })).toBeNull();
      expect(key({ key: 's', ctrlKey: true, shiftKey: true })).toBeNull();
      expect(key({ key: 'x', altKey: true })).toBeNull();
    });
  });
});
