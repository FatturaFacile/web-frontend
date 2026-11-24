import { ChartAccountDetail, LedgerBookCode, LEDGER_BOOK_CODES, PrimaNotaLinePayload } from '@core';
import { isValidCompetencePair } from '../accruals/competence-calculator.util';

/** One row of the Prima Nota grid. Amounts stay as typed text so the user can type freely; totals use integer cents. */
export interface PrimaNotaLine {
  key: number;
  accountId: string | null;
  accountQuery: string;
  description: string;
  debit: string;
  credit: string;
  costCenterId: string | null;
  competenceStartDate: string | null;
  competenceEndDate: string | null;
}

export interface PrimaNotaTotals {
  debitCents: number;
  creditCents: number;
  differenceCents: number;
}

export type PrimaNotaIssue =
  | 'description_required'
  | 'min_lines'
  | 'account_required'
  | 'amount_required'
  | 'both_sides'
  | 'unbalanced'
  | 'nothing_to_post'
  | 'competence_incomplete'
  | 'competence_inverted';

/** Parses a typed amount ("1.234,56", "1234.56", "12,5"): invalid or negative input counts as zero. */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  let text = String(value).trim().replace(/\s/g, '');
  if (text.includes(',') && text.includes('.')) {
    // The last separator is the decimal one.
    text =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function emptyLine(key: number): PrimaNotaLine {
  return {
    key,
    accountId: null,
    accountQuery: '',
    description: '',
    debit: '',
    credit: '',
    costCenterId: null,
    competenceStartDate: null,
    competenceEndDate: null,
  };
}

export function isLineEmpty(line: PrimaNotaLine): boolean {
  return (
    !line.accountId &&
    !line.accountQuery.trim() &&
    toCents(line.debit) === 0 &&
    toCents(line.credit) === 0
  );
}

export function computeTotals(lines: readonly PrimaNotaLine[]): PrimaNotaTotals {
  const debitCents = lines.reduce((sum, line) => sum + toCents(line.debit), 0);
  const creditCents = lines.reduce((sum, line) => sum + toCents(line.credit), 0);
  return { debitCents, creditCents, differenceCents: debitCents - creditCents };
}

export function isBalanced(totals: PrimaNotaTotals): boolean {
  return totals.debitCents > 0 && totals.differenceCents === 0;
}

/**
 * Puts the remainder on a line so that Dare equals Avere: the given line when it exists, otherwise the last empty
 * line, otherwise a new one. The remainder goes to the side that is short.
 */
export function autofillRemainder(
  lines: readonly PrimaNotaLine[],
  targetKey: number | null,
  nextKey: number,
): PrimaNotaLine[] {
  const next = [...lines];
  let index = targetKey === null ? -1 : next.findIndex((line) => line.key === targetKey);
  if (index < 0) {
    for (let i = next.length - 1; i >= 0; i--) {
      if (toCents(next[i].debit) === 0 && toCents(next[i].credit) === 0) {
        index = i;
        break;
      }
    }
  }
  if (index < 0) {
    next.push(emptyLine(nextKey));
    index = next.length - 1;
  }
  const others = computeTotals(next.filter((_, i) => i !== index));
  const difference = others.debitCents - others.creditCents;
  next[index] = {
    ...next[index],
    debit: difference < 0 ? fromCents(-difference) : '',
    credit: difference > 0 ? fromCents(difference) : '',
  };
  return next;
}

/** Everything that stops the entry from being posted; empty when it can be submitted. */
export function validateLines(
  description: string,
  lines: readonly PrimaNotaLine[],
): PrimaNotaIssue[] {
  const issues: PrimaNotaIssue[] = [];
  if (!description.trim()) {
    issues.push('description_required');
  }
  const used = lines.filter((line) => !isLineEmpty(line));
  if (used.length < 2) {
    issues.push('min_lines');
  }
  if (used.some((line) => !line.accountId)) {
    issues.push('account_required');
  }
  if (used.some((line) => toCents(line.debit) === 0 && toCents(line.credit) === 0)) {
    issues.push('amount_required');
  }
  if (used.some((line) => toCents(line.debit) > 0 && toCents(line.credit) > 0)) {
    issues.push('both_sides');
  }
  if (used.some((line) => isValidCompetencePair(line.competenceStartDate, line.competenceEndDate) === 'incomplete')) {
    issues.push('competence_incomplete');
  }
  if (used.some((line) => isValidCompetencePair(line.competenceStartDate, line.competenceEndDate) === 'inverted')) {
    issues.push('competence_inverted');
  }
  const totals = computeTotals(used);
  if (totals.debitCents === 0 && totals.creditCents === 0) {
    issues.push('nothing_to_post');
  } else if (!isBalanced(totals)) {
    issues.push('unbalanced');
  }
  return issues;
}

export function toLinePayloads(lines: readonly PrimaNotaLine[]): PrimaNotaLinePayload[] {
  return lines
    .filter((line) => !isLineEmpty(line))
    .map((line) => ({
      account_id: line.accountId ?? '',
      debit_amount: toCents(line.debit) / 100,
      credit_amount: toCents(line.credit) / 100,
      description: line.description.trim() || null,
      cost_center_id: line.costCenterId,
      ...(line.competenceStartDate && line.competenceEndDate
        ? {
            competence_start_date: line.competenceStartDate,
            competence_end_date: line.competenceEndDate,
          }
        : {}),
    }));
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function accountLabel(account: Pick<ChartAccountDetail, 'account_code' | 'name'>): string {
  return `${account.account_code ?? ''} ${account.name}`.trim();
}

/** Autocomplete by code or name: code prefixes first, then code or name containing the text. */
export function searchAccounts<T extends Pick<ChartAccountDetail, 'account_code' | 'name'>>(
  accounts: readonly T[],
  query: string,
  limit = 20,
): T[] {
  const needle = fold(query);
  if (!needle) {
    return accounts.slice(0, limit);
  }
  const prefix: T[] = [];
  const contains: T[] = [];
  for (const account of accounts) {
    const code = fold(account.account_code ?? '');
    if (code.startsWith(needle)) {
      prefix.push(account);
    } else if (code.includes(needle) || fold(account.name).includes(needle)) {
      contains.push(account);
    }
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** The books other than the one being posted to: the entry can be propagated to them. */
export function otherBooks(ledger: LedgerBookCode): LedgerBookCode[] {
  return LEDGER_BOOK_CODES.filter((code) => code !== ledger);
}

export type PrimaNotaShortcut =
  'add_line' | 'balance' | 'save_draft' | 'post' | 'next_ledger' | 'focus_template';

export interface ShortcutEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Keyboard map of the workbench: Alt+N add line, Alt+B balance, Ctrl+S draft, Ctrl+Enter post, Alt+L ledger, Alt+T template. */
export function resolveShortcut(event: ShortcutEventLike): PrimaNotaShortcut | null {
  const key = event.key.toLowerCase();
  const primary = event.ctrlKey || event.metaKey;
  if (primary && !event.altKey && key === 'enter') {
    return 'post';
  }
  if (primary && !event.altKey && !event.shiftKey && key === 's') {
    return 'save_draft';
  }
  if (event.altKey && !primary) {
    switch (key) {
      case 'n':
        return 'add_line';
      case 'b':
        return 'balance';
      case 'l':
        return 'next_ledger';
      case 't':
        return 'focus_template';
    }
  }
  return null;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
