import { describe, expect, it } from 'vitest';
import { apItem, batch, skonto } from './payables.fixtures';
import {
  agingFileName,
  bucketLabelParts,
  batchStatusColor,
  canBlockItem,
  canCancelBatch,
  canDecideBatch,
  canExecuteBatch,
  canReleaseItem,
  canSubmitBatch,
  formatIban,
  isBlockedItem,
  isCreditNote,
  isOverdue,
  isPayable,
  itemFiltersFromQuery,
  itemFiltersToQuery,
  itemStatusColor,
  skontoCapturable,
  skontoColor,
  skontoDaysParts,
  skontoState,
} from './payables.util';

describe('open item rules', () => {
  it('lets only open, non blocked, non credit note items be paid', () => {
    expect(isPayable(apItem('1'))).toBe(true);
    expect(isPayable(apItem('1', { status: 'disputed' }))).toBe(false);
    expect(isPayable(apItem('1', { status: 'blocked' }))).toBe(false);
    expect(isPayable(apItem('1', { status: 'in_batch' }))).toBe(false);
    expect(isPayable(apItem('1', { status: 'paid', open_amount: '0.00' }))).toBe(false);
    expect(isPayable(apItem('1', { document_type: 'credit_note', open_amount: '-10.00' }))).toBe(
      false,
    );
    expect(isPayable(apItem('1', { open_amount: '0.00' }))).toBe(false);
  });

  it('knows disputed and blocked items, and credit notes', () => {
    expect(isBlockedItem(apItem('1', { status: 'disputed' }))).toBe(true);
    expect(isBlockedItem(apItem('1', { status: 'blocked' }))).toBe(true);
    expect(isBlockedItem(apItem('1'))).toBe(false);
    expect(isCreditNote(apItem('1', { document_type: 'credit_note' }))).toBe(true);
  });

  it('allows to block an open item and to release a blocked one', () => {
    expect(canBlockItem(apItem('1'))).toBe(true);
    expect(canBlockItem(apItem('1', { status: 'in_batch' }))).toBe(false);
    expect(canBlockItem(apItem('1', { status: 'blocked' }))).toBe(false);
    expect(canReleaseItem(apItem('1', { status: 'disputed' }))).toBe(true);
    expect(canReleaseItem(apItem('1', { status: 'blocked' }))).toBe(true);
    expect(canReleaseItem(apItem('1'))).toBe(false);
  });

  it('flags overdue items only while unpaid', () => {
    expect(isOverdue(apItem('1', { due_date: '2026-03-01' }), '2026-04-01')).toBe(true);
    expect(isOverdue(apItem('1', { due_date: '2026-04-01' }), '2026-04-01')).toBe(false);
    expect(isOverdue(apItem('1', { due_date: '2026-03-01', status: 'paid' }), '2026-04-01')).toBe(
      false,
    );
  });

  it('colours every status', () => {
    expect(itemStatusColor('blocked')).toBe('red');
    expect(itemStatusColor('disputed')).toBe('orange');
    expect(itemStatusColor('paid')).toBe('green');
    expect(itemStatusColor('in_batch')).toBe('blue');
    expect(itemStatusColor('authorized')).toBe('cyan');
    expect(itemStatusColor('open')).toBe('processing');
  });
});

describe('skonto', () => {
  it('has no state without terms', () => {
    expect(skontoState(null)).toBe('none');
  });

  it('is active, expiring on the last days and expired afterwards', () => {
    expect(skontoState(skonto({ days_remaining: 8 }))).toBe('active');
    expect(skontoState(skonto({ days_remaining: 3 }))).toBe('expiring');
    expect(skontoState(skonto({ days_remaining: 0 }))).toBe('expiring');
    expect(skontoState(skonto({ days_remaining: -1 }))).toBe('expired');
  });

  it('colours the urgency', () => {
    expect(skontoColor('active')).toBe('green');
    expect(skontoColor('expiring')).toBe('orange');
    expect(skontoColor('expired')).toBe('default');
  });

  it('words the days left, the last day and the days since the expiry', () => {
    expect(skontoDaysParts(skonto({ days_remaining: 8 }))).toEqual({
      key: 'AP.SKONTO_DAYS_LEFT',
      params: { days: 8 },
    });
    expect(skontoDaysParts(skonto({ days_remaining: 0 }))).toEqual({
      key: 'AP.SKONTO_LAST_DAY',
      params: {},
    });
    expect(skontoDaysParts(skonto({ days_remaining: -4 }))).toEqual({
      key: 'AP.SKONTO_EXPIRED_DAYS',
      params: { days: 4 },
    });
  });

  it('counts the discount as capturable only on an open item before the deadline', () => {
    expect(skontoCapturable(apItem('1', { skonto: skonto() }))).toBe(true);
    expect(skontoCapturable(apItem('1', { skonto: skonto({ days_remaining: -1 }) }))).toBe(false);
    expect(skontoCapturable(apItem('1', { skonto: skonto(), status: 'blocked' }))).toBe(false);
    expect(skontoCapturable(apItem('1'))).toBe(false);
  });
});

describe('batch workflow', () => {
  it('submits a draft or a rejected batch', () => {
    expect(canSubmitBatch(batch({ status: 'draft' }))).toBe(true);
    expect(canSubmitBatch(batch({ status: 'rejected' }))).toBe(true);
    expect(canSubmitBatch(batch({ status: 'pending_approval' }))).toBe(false);
  });

  it('decides only a batch pending the CFO and executes only an approved one', () => {
    expect(canDecideBatch(batch({ status: 'pending_approval' }))).toBe(true);
    expect(canDecideBatch(batch({ status: 'draft' }))).toBe(false);
    expect(canExecuteBatch(batch({ status: 'approved' }))).toBe(true);
    expect(canExecuteBatch(batch({ status: 'pending_approval' }))).toBe(false);
    expect(canExecuteBatch(batch({ status: 'executed' }))).toBe(false);
  });

  it('cancels a batch until it is approved', () => {
    for (const status of ['draft', 'rejected', 'pending_approval'] as const) {
      expect(canCancelBatch(batch({ status }))).toBe(true);
    }
    for (const status of ['approved', 'executed', 'cancelled'] as const) {
      expect(canCancelBatch(batch({ status }))).toBe(false);
    }
  });

  it('colours every batch status', () => {
    expect(batchStatusColor('draft')).toBe('processing');
    expect(batchStatusColor('pending_approval')).toBe('gold');
    expect(batchStatusColor('approved')).toBe('cyan');
    expect(batchStatusColor('executed')).toBe('green');
    expect(batchStatusColor('rejected')).toBe('red');
    expect(batchStatusColor('cancelled')).toBe('default');
  });
});

describe('formatting', () => {
  it('groups an IBAN by four characters', () => {
    expect(formatIban('IT60X0542811101000000123456')).toBe('IT60 X054 2811 1010 0000 0123 456');
    expect(formatIban('it60 x054')).toBe('it60 x054');
    expect(formatIban(null)).toBe('');
  });

  it('names the aging buckets from their bounds', () => {
    expect(bucketLabelParts({ key: 'current', from: null, to: 0 })).toEqual({
      key: 'AP.BUCKET_CURRENT',
    });
    expect(bucketLabelParts({ key: '1_30', from: 1, to: 30 })).toEqual({
      key: 'AP.BUCKET_RANGE',
      params: { from: 1, to: 30 },
    });
    expect(bucketLabelParts({ key: '91_plus', from: 91, to: null })).toEqual({
      key: 'AP.BUCKET_OVER',
      params: { from: 91 },
    });
  });

  it('names the aging export files', () => {
    expect(agingFileName('2026-04-01', 'xlsx')).toBe('payables-aging-2026-04-01.xlsx');
    expect(agingFileName('2026-04-01', 'pdf')).toBe('payables-aging-2026-04-01.pdf');
  });
});

describe('items query string', () => {
  it('reads the filters and ignores unknown statuses and document types', () => {
    expect(
      itemFiltersFromQuery({
        supplier_id: 's-1',
        status: 'blocked',
        document_type: 'qr_bill',
        due_from: '2026-04-01',
        skonto_only: '1',
        open_only: '0',
      }),
    ).toEqual({
      supplier_id: 's-1',
      status: 'blocked',
      document_type: 'qr_bill',
      due_from: '2026-04-01',
      skonto_only: true,
      open_only: false,
    });
    expect(itemFiltersFromQuery({ status: 'weird', document_type: 'x', currency: '' })).toEqual({});
  });

  it('writes only the filters that are set, booleans as 1 / 0', () => {
    expect(
      itemFiltersToQuery({
        supplier_id: 's-1',
        status: 'open',
        skonto_only: true,
        open_only: false,
        page: 3,
      }),
    ).toEqual({ supplier_id: 's-1', status: 'open', skonto_only: '1', open_only: '0' });
    expect(itemFiltersToQuery({})).toEqual({});
  });
});
