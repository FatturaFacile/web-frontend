import { ApAging, ApBatch, ApBatchPreview, ApItem, ApSkonto } from '@core';

/** Test data shared by the specs of the payables feature. */
export function skonto(overrides: Partial<ApSkonto> = {}): ApSkonto {
  return {
    percent: '2.00',
    deadline: '2026-04-10',
    days_remaining: 8,
    savings: '20.00',
    net_payable: '980.00',
    terms: '30 days, 2% within 10 days',
    ...overrides,
  };
}

export function apItem(id: string, overrides: Partial<ApItem> = {}): ApItem {
  return {
    id,
    supplier_id: 's-1',
    supplier_name: 'Acme Forniture',
    supplier_iban: 'IT60X0542811101000000123456',
    document_type: 'xml_invoice',
    document_number: `FA-${id}`,
    issue_date: '2026-03-11',
    due_date: '2026-04-10',
    currency: 'EUR',
    original_amount: '1000.00',
    open_amount: '1000.00',
    status: 'open',
    block_reason: null,
    batch_id: null,
    skonto: null,
    ...overrides,
  };
}

export function batch(overrides: Partial<ApBatch> = {}): ApBatch {
  return {
    id: 'b-1',
    number: 'DP-2026-0001',
    status: 'draft',
    cutoff_date: '2026-04-15',
    currency: 'EUR',
    prioritize_skonto: true,
    totals: {
      gross_amount: '2000.00',
      set_off_amount: '150.00',
      skonto_savings: '20.00',
      net_amount: '1830.00',
      transfers: 1,
      lines: 2,
    },
    transfers: [
      {
        iban: 'IT60X0542811101000000123456',
        supplier_id: 's-1',
        supplier_name: 'Acme Forniture',
        currency: 'EUR',
        gross_amount: '2000.00',
        set_off_amount: '150.00',
        skonto_savings: '20.00',
        net_amount: '1830.00',
        lines: [
          {
            item_id: 'i-1',
            supplier_id: 's-1',
            supplier_name: 'Acme Forniture',
            document_number: 'FA-i-1',
            due_date: '2026-04-10',
            open_amount: '1000.00',
            pay_amount: '980.00',
            skonto_taken: true,
            skonto_savings: '20.00',
          },
          {
            item_id: 'i-2',
            supplier_id: 's-1',
            supplier_name: 'Acme Forniture',
            document_number: 'FA-i-2',
            due_date: '2026-04-12',
            open_amount: '1000.00',
            pay_amount: '850.00',
            skonto_taken: false,
            skonto_savings: '0.00',
          },
        ],
      },
    ],
    set_offs: [
      {
        credit_note_id: 'cn-1',
        credit_note_number: 'NC-1',
        supplier_id: 's-1',
        supplier_name: 'Acme Forniture',
        amount: '150.00',
        applied_to_item_ids: ['i-2'],
      },
    ],
    approval: null,
    executed_at: null,
    created_at: '2026-04-01T08:00:00Z',
    ...overrides,
  };
}

export function preview(overrides: Partial<ApBatchPreview> = {}): ApBatchPreview {
  return {
    cutoff_date: '2026-04-15',
    currency: 'EUR',
    candidates: [apItem('i-1', { skonto: skonto() }), apItem('i-2', { due_date: '2026-04-12' })],
    credit_notes: [
      apItem('cn-1', {
        document_type: 'credit_note',
        document_number: 'NC-1',
        original_amount: '-150.00',
        open_amount: '-150.00',
      }),
    ],
    excluded: [{ item_id: 'i-9', reason: 'blocked' }],
    batch: batch(),
    ...overrides,
  };
}

export const aging: ApAging = {
  as_of: '2026-04-01',
  currency: 'EUR',
  available_currencies: ['EUR', 'CHF'],
  buckets: [
    { key: 'current', from: null, to: 0 },
    { key: '1_30', from: 1, to: 30 },
    { key: '31_60', from: 31, to: 60 },
    { key: '61_90', from: 61, to: 90 },
    { key: '91_plus', from: 91, to: null },
  ],
  totals: {
    current: '1000.00',
    '1_30': '500.00',
    '31_60': '250.00',
    '61_90': '0.00',
    '91_plus': '100.00',
  },
  total_open: '1850.00',
  total_overdue: '850.00',
  suppliers: [
    {
      supplier_id: 's-1',
      supplier_name: 'Acme Forniture',
      buckets: {
        current: '1000.00',
        '1_30': '500.00',
        '31_60': '0.00',
        '61_90': '0.00',
        '91_plus': '0.00',
      },
      total_open: '1500.00',
      total_overdue: '500.00',
      items: 4,
    },
    {
      supplier_id: 's-2',
      supplier_name: 'Beta SA',
      buckets: {
        current: '0.00',
        '1_30': '0.00',
        '31_60': '250.00',
        '61_90': '0.00',
        '91_plus': '100.00',
      },
      total_open: '350.00',
      total_overdue: '350.00',
      items: 2,
    },
  ],
};
