import { HttpErrorResponse } from '@angular/common/http';
import {
  CsvField,
  CsvMapping,
  F24DelegationLine,
  F24Section,
  PaymentFlowCode,
  ProposalKind,
  ProposalRule,
} from '@core/models/treasury-banking.model';

export const F24_SECTIONS: F24Section[] = ['erario', 'inps', 'regioni', 'imu', 'inail'];

export const PAYMENT_FLOWS: PaymentFlowCode[] = ['ch_pain001_09', 'sepa_pain001_03', 'cbi_sepa_03'];

export const CSV_FIELDS: CsvField[] = [
  'booking_date',
  'value_date',
  'amount',
  'debit',
  'credit',
  'fee',
  'description',
  'reference',
  'qr_reference',
  'counterpart_name',
  'counterpart_iban',
  'entry_reference',
];

export const STATEMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Whole cents of a decimal text ("1.234,50" is not accepted: the API speaks plain decimals); NaN when unreadable. */
export function toCents(value: string | number | null | undefined): number {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');

  if (text === '') {
    return 0;
  }

  if (!/^-?\d+(\.\d{0,2})?$/.test(text)) {
    return Number.NaN;
  }

  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));

  return negative ? -cents : cents;
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);

  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export interface F24Balance {
  debit: string;
  credit: string;
  payable: string;
  /** Credits compensated never exceed the debits, and every amount is readable. */
  balanced: boolean;
  creditExceedsDebit: boolean;
  zeroBalance: boolean;
  invalidAmounts: boolean;
}

/** Debit, compensated credit and payable balance of the F24 lines, in exact cents. */
export function f24Balance(
  lines: readonly Pick<F24DelegationLine, 'debit_amount' | 'credit_amount'>[],
): F24Balance {
  let debit = 0;
  let credit = 0;
  let invalid = false;

  for (const line of lines) {
    const d = toCents(line.debit_amount);
    const c = toCents(line.credit_amount);

    if (Number.isNaN(d) || Number.isNaN(c) || d < 0 || c < 0) {
      invalid = true;
      continue;
    }

    debit += d;
    credit += c;
  }

  const exceeds = credit > debit;

  return {
    debit: fromCents(debit),
    credit: fromCents(credit),
    payable: fromCents(debit - credit),
    balanced: !invalid && !exceeds && debit > 0,
    creditExceedsDebit: exceeds,
    zeroBalance: !invalid && debit > 0 && debit === credit,
    invalidAmounts: invalid,
  };
}

export function emptyF24Line(section: F24Section = 'erario'): F24DelegationLine {
  return {
    section,
    tax_code: '',
    institution_code: '',
    reference_number: '',
    installment: '',
    reference_period: '',
    reference_year: String(new Date().getFullYear()),
    debit_amount: '0.00',
    credit_amount: '0.00',
  };
}

export function emptyCsvMapping(): CsvMapping {
  return {
    account_iban: '',
    currency: 'EUR',
    delimiter: ';',
    has_header: true,
    date_format: 'd/m/Y',
    decimal_separator: ',',
    thousands_separator: '.',
    columns: {},
  };
}

/** Whether the mapping is complete enough to be sent: a date, an amount (or debit / credit) and the account. */
export function isCsvMappingReady(mapping: CsvMapping): boolean {
  const columns = mapping.columns;
  const hasAmount = !!columns.amount || !!columns.debit || !!columns.credit;

  return mapping.account_iban.trim() !== '' && !!columns.booking_date && hasAmount;
}

export type ConfidenceTone = 'green' | 'blue' | 'orange' | 'red';

/** 95-100 can be applied without a second look, below 70 deserves a careful review. */
export function confidenceTone(confidence: number): ConfidenceTone {
  if (confidence >= 95) {
    return 'green';
  }

  if (confidence >= 80) {
    return 'blue';
  }

  return confidence >= 70 ? 'orange' : 'red';
}

export function ruleLabelKey(rule: ProposalRule): string {
  return `tbk.rule.${rule}`;
}

export function kindLabelKey(kind: ProposalKind | null): string {
  return `tbk.kind.${kind ?? 'exact'}`;
}

/** The messages of a Laravel 422 response, flattened; a plain error gives its message. */
export function apiErrorMessages(error: unknown): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [];
  }

  const errors = error.error?.errors as Record<string, string[]> | undefined;

  if (errors) {
    return Object.values(errors).flat();
  }

  const detail = error.error?.detail ?? error.error?.message;

  return typeof detail === 'string' && detail !== '' ? [detail] : [];
}

export function isStatementFile(file: { name: string; size: number }): boolean {
  return /\.(xml|txt|cbi|csv|dat)$/i.test(file.name) && file.size <= STATEMENT_MAX_BYTES;
}

/** `YYYY-MM-DD` of a date in the local time zone (never shifted through UTC). */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}
