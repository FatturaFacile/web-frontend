import {
  IsoUploadResult,
  ReconciliationException,
  ReconciliationExceptionPage,
} from '@core/models/iso20022.model';

export const exceptionLine = (over: Partial<ReconciliationException> = {}): ReconciliationException => ({
  id: 'l-1',
  bank_statement_id: 's-1',
  booking_date: '2026-03-14',
  value_date: '2026-03-14',
  direction: 'credit',
  amount: 648.5,
  fee_amount: 1.5,
  currency: 'CHF',
  gross_amount: 650,
  reference: 'BANK-1',
  qr_reference: '210000000003139471430009017',
  description: 'Invoice payment',
  counterpart_name: 'Cafe Mueller AG',
  counterpart_iban: 'CH4431999123000889012',
  reconciled: false,
  exception_code: 'AmountMismatch',
  exception_candidate: {
    id: 'inv-1',
    invoice_number: 'FA-2026-0042',
    kind: 'customer',
    due_amount: 650,
    currency: 'CHF',
  },
  ...over,
});

export const exceptionPage = (
  data: ReconciliationException[],
  counts: Partial<Record<string, number>> = {},
): ReconciliationExceptionPage => ({
  success: true,
  message: '',
  data,
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: data.length,
    counts: {
      Unmatched: 0,
      AmountMismatch: 0,
      DuplicatePayment: 0,
      AlreadyPaid: 0,
      InvalidReference: 0,
      ...counts,
    },
  },
});

export const camtResult: IsoUploadResult = {
  type: 'camt.053',
  filename: 'camt053.xml',
  statement: {
    id: 's-1',
    account_iban: 'CH4431999123000889012',
    statement_date: '2026-03-14',
    currency: 'CHF',
    total_entries: 4,
    source_format: 'camt053',
    status: 'partially_reconciled',
  },
  reconciliation: { reconciled: 3, unmatched: 1 },
  duplicates: 2,
};

export const painResult: IsoUploadResult = {
  type: 'pain.002',
  filename: 'pain002.xml',
  payment_report: {
    batch_id: 'b-1',
    batch_reference: 'DIST-2026-0007',
    batch_status: 'exported',
    group_status: 'PART',
    accepted: 1,
    rejected: 1,
    pending: 0,
    transactions: [
      {
        end_to_end_id: 'E2E-1',
        instruction_id: 'I-1',
        status: 'ACSC',
        reason_code: null,
        additional_info: null,
        line_status: 'executed',
      },
      {
        end_to_end_id: 'E2E-2',
        instruction_id: 'I-2',
        status: 'RJCT',
        reason_code: 'AC04',
        additional_info: 'Account closed',
        line_status: 'rejected',
      },
    ],
  },
};
