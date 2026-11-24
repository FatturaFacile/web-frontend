import { describe, expect, it } from 'vitest';
import { AccountLedgerReport, LedgerTrialBalance } from '@core';
import {
  accountLedgerTable,
  escapeHtml,
  toCsv,
  toPrintHtml,
  trialBalanceTable,
} from './gl-report-export.util';

const t = (key: string): string => key;

const row = {
  account_id: 'a1',
  account_code: '1100',
  account_name: 'Bank',
  account_type: 'asset',
  normal_balance: 'debit',
  opening_balance: '10.0000',
  debit: '5.0000',
  credit: '2.0000',
  closing_balance: '13.0000',
};

const fourColumns: LedgerTrialBalance = {
  currency: 'EUR',
  from: '2026-01-01',
  to: '2026-12-31',
  compare_from: null,
  compare_to: null,
  accounts: [row],
  totals: {
    opening_balance: '10.0000',
    debit: '5.0000',
    credit: '2.0000',
    closing_balance: '13.0000',
  },
  is_balanced: true,
};

const twoColumns: LedgerTrialBalance = {
  ...fourColumns,
  accounts: [{ ...row, debit_balance: '13.0000', credit_balance: '0.0000' }],
  totals: { debit_balance: '13.0000', credit_balance: '0.0000' },
};

describe('gl report export util', () => {
  it('lays the trial balance out in four columns', () => {
    const table = trialBalanceTable(fourColumns, 4, t);
    expect(table.headers).toEqual([
      'GL.COL_ACCOUNT_CODE',
      'GL.COL_ACCOUNT_NAME',
      'GL.COL_OPENING',
      'GL.COL_DEBIT',
      'GL.COL_CREDIT',
      'GL.COL_CLOSING',
    ]);
    expect(table.rows[0]).toEqual(['1100', 'Bank', '10.0000', '5.0000', '2.0000', '13.0000']);
    expect(table.footer).toEqual(['GL.COL_TOTAL', '', '10.0000', '5.0000', '2.0000', '13.0000']);
  });

  it('lays the trial balance out in two columns with the side balances', () => {
    const table = trialBalanceTable(twoColumns, 2, t);
    expect(table.headers).toEqual([
      'GL.COL_ACCOUNT_CODE',
      'GL.COL_ACCOUNT_NAME',
      'GL.TB_DEBIT_BALANCE',
      'GL.TB_CREDIT_BALANCE',
    ]);
    expect(table.rows[0]).toEqual(['1100', 'Bank', '13.0000', '0.0000']);
    expect(table.footer).toEqual(['GL.COL_TOTAL', '', '13.0000', '0.0000']);
  });

  it('lists the lines of the account ledger with the running balance', () => {
    const report = {
      account: {
        id: 'a1',
        account_code: '1100',
        name: 'Bank',
        account_type: 'asset',
        normal_balance: 'debit',
      },
      from: '2026-01-01',
      to: '2026-12-31',
      total_debit: '5.0000',
      total_credit: '2.0000',
      closing_balance: '13.0000',
      lines: [
        {
          posting_date: '2026-02-01',
          entry_number: 'JE-1',
          description: 'Rent',
          debit: '5.0000',
          credit: '0.0000',
          running_balance: '15.0000',
        },
      ],
    } as unknown as AccountLedgerReport;
    const table = accountLedgerTable(report, t);
    expect(table.rows[0]).toEqual(['2026-02-01', 'JE-1', 'Rent', '5.0000', '0.0000', '15.0000']);
    expect(table.title).toContain('1100 Bank');
  });

  it('writes a semicolon separated CSV with a BOM and quotes the cells that need it', () => {
    const csv = toCsv({
      title: 't',
      headers: ['a', 'b'],
      rows: [
        ['x;y', 'say "hi"'],
        ['-12.50', 'plain'],
      ],
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')).toEqual(['\uFEFFa;b', '"x;y";"say ""hi"""', '-12.50;plain']);
  });

  it('neutralises spreadsheet formulas in text cells but keeps negative numbers', () => {
    const csv = toCsv({
      title: 't',
      headers: ['h'],
      rows: [['=SUM(A1)'], ['@cmd'], ['-dash'], ['-5']],
    });
    expect(csv.split('\r\n').slice(1)).toEqual(["'=SUM(A1)", "'@cmd", "'-dash", '-5']);
  });

  it('escapes the text of the print view', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;',
    );
    const html = toPrintHtml({
      title: '<script>',
      headers: ['h'],
      rows: [['<img src=x>']],
      footer: ['f'],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('<tfoot>');
  });
});
