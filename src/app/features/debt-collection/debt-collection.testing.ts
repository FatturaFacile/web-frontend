import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  DcBatch,
  DcCustomerHistory,
  DcDashboard,
  DcLookups,
  DcNotice,
  DcProposalGroup,
  DcProposalItem,
} from '@core';
import { DEFAULT_LOOKUPS } from './lookups.store';

/** Fixtures shared by the specs of the debt collection feature. */

export const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });

export const pageMeta = { current_page: 1, last_page: 1, per_page: 20, total: 2 };

/** Stand-in of the translation service: keys come back unchanged so the specs can assert on them. */
export function translateSpy() {
  return {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

export const lookups: DcLookups = {
  ...DEFAULT_LOOKUPS,
  template_codes: ['reminder_1', 'reminder_2'],
};

export function proposalItem(id: string, overrides: Partial<DcProposalItem> = {}): DcProposalItem {
  return {
    receivable_item_id: id,
    case_id: null,
    customer_id: 'c-1',
    customer_name: 'ACME SA',
    document_number: `INV-${id}`,
    due_date: '2026-03-01',
    currency: 'CHF',
    jurisdiction: 'CH',
    open_amount: '1000.00',
    days_overdue: 40,
    current_level: null,
    proposed_level: 1,
    status: 'proposed',
    exclusion_reason: null,
    waiting_until: null,
    interest_amount: '5.48',
    interest_days: 40,
    interest_rate_percent: '5.00',
    fee_amount: '10.00',
    total: '1015.48',
    policy_id: 'p-1',
    ...overrides,
  };
}

export function proposalGroup(overrides: Partial<DcProposalGroup> = {}): DcProposalGroup {
  return {
    key: 'c-1|CHF|1',
    customer_id: 'c-1',
    customer_name: 'ACME SA',
    currency: 'CHF',
    jurisdiction: 'CH',
    level: 1,
    receivable_item_ids: ['r-1', 'r-2'],
    principal: '2000.00',
    interest: '10.96',
    fee: '10.00',
    total: '2020.96',
    new_due_date: '2026-05-15',
    channels: ['email', 'pec', 'sms'],
    has_pec: false,
    has_email: true,
    has_phone: false,
    ...overrides,
  };
}

export function notice(id: string, overrides: Partial<DcNotice> = {}): DcNotice {
  return {
    id,
    number: `SOL-${id}`,
    kind: 'reminder',
    level: 1,
    customer_id: 'c-1',
    customer_name: 'ACME SA',
    jurisdiction: 'CH',
    currency: 'CHF',
    principal: '2000.00',
    interest: '10.96',
    fee: '10.00',
    total: '2020.96',
    new_due_date: '2026-05-15',
    issued_on: '2026-05-05',
    channel: 'email',
    status: 'draft',
    locale: 'de',
    batch_id: null,
    pec_message_id: null,
    sent_at: null,
    error: null,
    attempts: 0,
    charge_receivable_item_id: null,
    lines: [],
    receipts: [],
    has_pdf: true,
    ...overrides,
  };
}

export function batch(id: string, overrides: Partial<DcBatch> = {}): DcBatch {
  return {
    id,
    channel: 'email',
    status: 'completed',
    total: 4,
    sent: 4,
    failed: 0,
    started_at: '2026-05-05T08:00:00Z',
    completed_at: '2026-05-05T08:01:00Z',
    created_at: '2026-05-05T07:59:00Z',
    ...overrides,
  };
}

export const dashboard: DcDashboard = {
  overdue: [{ currency: 'CHF', jurisdiction: 'CH', amount: '12000.00', items: 7 }],
  proposals: { total: 9, by_level: { '0': 1, '1': 4, '2': 3, '3': 1 } },
  excluded: 2,
  notices_30d: { sent: 11, failed: 1, delivered: 8 },
  enforcement_open: 3,
  pec_awaiting_receipts: 2,
  interest_accrued: [{ currency: 'CHF', amount: '120.50' }],
  batches_running: 1,
};

export function history(overrides: Partial<DcCustomerHistory> = {}): DcCustomerHistory {
  return {
    customer: { id: 'c-1', name: 'ACME SA', country: 'CH', pec: null, email: 'acme@example.test' },
    summary: {
      open_overdue: [{ currency: 'CHF', amount: '2000.00' }],
      current_level: 2,
      interest_accrued: [{ currency: 'CHF', amount: '10.96' }],
      fees_charged: [{ currency: 'CHF', amount: '30.00' }],
      active_exclusions: 1,
      active_plans: 0,
    },
    notices: [
      notice('n-1', {
        status: 'sent',
        channel: 'pec',
        receipts: [
          {
            id: 'rc-1',
            kind: 'consegna',
            message_id: 'm-1',
            received_at: '2026-05-06T10:00:00Z',
            notes: null,
          },
        ],
      }),
    ],
    dossiers: [],
    exclusions: [
      {
        id: 'x-1',
        customer_id: 'c-1',
        customer_name: 'ACME SA',
        receivable_item_id: null,
        type: 'dispute',
        reason: 'Goods damaged',
        notes: null,
        created_at: '2026-05-01T09:00:00Z',
        released_at: null,
      },
    ],
    plans: [],
    timeline: [
      {
        id: 't-1',
        event: 'notice_sent',
        occurred_at: '2026-05-05T08:00:00Z',
        level: 1,
        amount: '2020.96',
        currency: 'CHF',
        subject_type: 'notice',
        subject_id: 'n-1',
        payload: {},
        actor_id: null,
      },
    ],
    ...overrides,
  };
}
