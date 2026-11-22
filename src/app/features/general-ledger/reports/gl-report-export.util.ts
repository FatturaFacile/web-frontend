import { AccountLedgerReport, LedgerTrialBalance } from '@core';
import { downloadBlob } from '../shared/gl-dates';

export interface ReportTable {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string[];
}

export type Translate = (key: string) => string;

/** Trial balance rows in the layout the user sees: 2 columns (side balances) or 4 (opening, debit, credit, closing). */
export function trialBalanceTable(
  report: LedgerTrialBalance,
  columns: 2 | 4,
  t: Translate,
): ReportTable {
  const totals = (Array.isArray(report.totals) ? {} : report.totals) as Record<string, string>;
  const account = [t('GL.COL_ACCOUNT_CODE'), t('GL.COL_ACCOUNT_NAME')];
  if (columns === 2) {
    return {
      title: `${t('GL.REPORT_TRIAL_BALANCE')} ${report.from} - ${report.to}`,
      headers: [...account, t('GL.TB_DEBIT_BALANCE'), t('GL.TB_CREDIT_BALANCE')],
      rows: report.accounts.map((row) => [
        row.account_code,
        row.account_name,
        row.debit_balance ?? '0.00',
        row.credit_balance ?? '0.00',
      ]),
      footer: [
        t('GL.COL_TOTAL'),
        '',
        totals['debit_balance'] ?? '',
        totals['credit_balance'] ?? '',
      ],
    };
  }
  return {
    title: `${t('GL.REPORT_TRIAL_BALANCE')} ${report.from} - ${report.to}`,
    headers: [
      ...account,
      t('GL.COL_OPENING'),
      t('GL.COL_DEBIT'),
      t('GL.COL_CREDIT'),
      t('GL.COL_CLOSING'),
    ],
    rows: report.accounts.map((row) => [
      row.account_code,
      row.account_name,
      row.opening_balance,
      row.debit,
      row.credit,
      row.closing_balance,
    ]),
    footer: [
      t('GL.COL_TOTAL'),
      '',
      totals['opening_balance'] ?? '',
      totals['debit'] ?? '',
      totals['credit'] ?? '',
      totals['closing_balance'] ?? '',
    ],
  };
}

export function accountLedgerTable(report: AccountLedgerReport, t: Translate): ReportTable {
  const code = report.account.account_code ?? '';
  return {
    title:
      `${t('GL.REPORT_ACCOUNT_LEDGER')} ${code} ${report.account.name} ${report.from} - ${report.to}`.trim(),
    headers: [
      t('GL.COL_DATE'),
      t('GL.COL_ENTRY'),
      t('GL.COL_DESCRIPTION'),
      t('GL.COL_DEBIT'),
      t('GL.COL_CREDIT'),
      t('GL.COL_RUNNING_BALANCE'),
    ],
    rows: report.lines.map((line) => [
      line.posting_date,
      line.entry_number,
      line.description,
      line.debit,
      line.credit,
      line.running_balance,
    ]),
    footer: [
      t('GL.COL_TOTAL'),
      '',
      '',
      report.total_debit,
      report.total_credit,
      report.closing_balance,
    ],
  };
}

function csvCell(value: string): string {
  // Spreadsheet formula injection: a leading = + - @ would be evaluated, so the cell is forced to text.
  const safe =
    /^[=+@]/.test(value) || (/^-/.test(value) && Number.isNaN(Number(value))) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Semicolon separated (the spreadsheet default of the Italian, German and French locales) with a BOM for UTF-8. */
export function toCsv(table: ReportTable): string {
  const lines = [table.headers, ...table.rows, ...(table.footer ? [table.footer] : [])];
  return '\uFEFF' + lines.map((line) => line.map(csvCell).join(';')).join('\r\n');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Standalone printable document of the table (no application chrome). */
export function toPrintHtml(table: ReportTable): string {
  const head = table.headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  const foot = table.footer
    ? `<tfoot><tr>${table.footer.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></tfoot>`
    : '';
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(table.title)}</title>` +
    '<style>body{font:12px/1.4 sans-serif;margin:24px}table{width:100%;border-collapse:collapse}' +
    'th,td{border-bottom:1px solid #ccc;padding:3px 6px;text-align:left}td:nth-child(n+3),th:nth-child(n+3){text-align:right}' +
    'tfoot th{border-top:2px solid #000}</style></head>' +
    `<body><h1>${escapeHtml(table.title)}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></body></html>`
  );
}

export function exportCsv(table: ReportTable, fileName: string): void {
  downloadBlob(new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' }), `${fileName}.csv`);
}

export function exportJson(data: unknown, fileName: string): void {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `${fileName}.json`,
  );
}

export function printReport(table: ReportTable): void {
  const win = window.open('', '_blank');
  if (!win) {
    return;
  }
  win.document.write(toPrintHtml(table));
  win.document.close();
  win.focus();
  win.print();
}
