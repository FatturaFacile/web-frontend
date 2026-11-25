import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { proposalGroup, proposalItem } from './debt-collection.testing';
import {
  addMonths,
  batchProgress,
  buildInstallments,
  canCancelNotice,
  canRegisterReceipt,
  canRetryBatch,
  canSendNotice,
  errorKey,
  failureOf,
  groupSelectionKey,
  isSelectable,
  levelColor,
  orUndefined,
  reachableChannels,
  sumDecimals,
  totalsByCurrency,
} from './debt-collection.util';

describe('debt collection util', () => {
  it('builds the translation key of an error code, with a generic fallback', () => {
    expect(errorKey('no_policy')).toBe('debtCollection.error.no_policy');
    expect(errorKey(undefined)).toBe('debtCollection.error.generic');
    expect(errorKey(null)).toBe('debtCollection.error.generic');
  });

  it('reads the problem code and the first field error of a failed call', async () => {
    const outcome = await failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { code: 'invalid_level', errors: { level: ['Level is invalid'] } },
      }),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('debtCollection.error.invalid_level');
    expect(outcome.detail).toBe('Level is invalid');
    expect(outcome.errors).toEqual({ level: ['Level is invalid'] });
  });

  it('reads the problem of a failed download, which answers a Blob', async () => {
    const blob = new Blob([JSON.stringify({ code: 'dossier_no_office' })], {
      type: 'application/json',
    });
    const outcome = await failureOf(new HttpErrorResponse({ status: 422, error: blob }));

    expect(outcome.errorKey).toBe('debtCollection.error.dossier_no_office');
  });

  it('falls back to the generic error for something that is not an HTTP error', async () => {
    const outcome = await failureOf(new Error('boom'));

    expect(outcome.errorKey).toBe('debtCollection.error.generic');
    expect(outcome.detail).toBeNull();
  });

  it('adds decimal strings exactly in cents', () => {
    expect(sumDecimals(['0.10', '0.20'])).toBe('0.30');
    expect(sumDecimals(['1234.50', '0.05'])).toBe('1234.55');
    expect(sumDecimals([])).toBe('0.00');
  });

  it('totals the selected groups per currency', () => {
    const totals = totalsByCurrency([
      proposalGroup({ total: '100.00' }),
      proposalGroup({ total: '50.25' }),
      proposalGroup({ currency: 'EUR', total: '10.00' }),
    ]);

    expect(totals).toEqual([
      { currency: 'CHF', amount: '150.25' },
      { currency: 'EUR', amount: '10.00' },
    ]);
  });

  it('keys a group by customer, currency and level', () => {
    expect(groupSelectionKey({ customer_id: 'c-1', currency: 'CHF', level: 2 })).toBe('c-1|CHF|2');
  });

  it('lets only a proposed item with a level into a notice', () => {
    expect(isSelectable(proposalItem('1'))).toBe(true);
    expect(isSelectable(proposalItem('2', { status: 'excluded' }))).toBe(false);
    expect(isSelectable(proposalItem('3', { status: 'waiting' }))).toBe(false);
    expect(isSelectable(proposalItem('4', { proposed_level: null }))).toBe(false);
  });

  it('lists the channels the customer can actually be reached on', () => {
    expect(reachableChannels(proposalGroup())).toEqual(['email']);
    expect(reachableChannels(proposalGroup({ has_pec: true, has_phone: true }))).toEqual([
      'email',
      'pec',
      'sms',
    ]);
  });

  it('decides what can be done with a notice and a batch from its status', () => {
    expect(canSendNotice('draft')).toBe(true);
    expect(canSendNotice('failed')).toBe(true);
    expect(canSendNotice('delivered')).toBe(false);
    expect(canCancelNotice('queued')).toBe(true);
    expect(canCancelNotice('sent')).toBe(false);
    expect(canRegisterReceipt({ channel: 'pec', status: 'sent' })).toBe(true);
    expect(canRegisterReceipt({ channel: 'email', status: 'sent' })).toBe(false);
    expect(canRegisterReceipt({ channel: 'pec', status: 'draft' })).toBe(false);
    expect(canRetryBatch({ status: 'partial', failed: 2 })).toBe(true);
    expect(canRetryBatch({ status: 'completed', failed: 0 })).toBe(false);
  });

  it('computes the progress of a batch', () => {
    expect(batchProgress({ total: 4, sent: 2, failed: 1 })).toBe(75);
    expect(batchProgress({ total: 0, sent: 0, failed: 0 })).toBe(0);
    expect(batchProgress({ total: 2, sent: 3, failed: 0 })).toBe(100);
  });

  it('gives each level a colour and none a neutral one', () => {
    expect(levelColor(3)).toBe('red');
    expect(levelColor(null)).toBe('default');
  });

  it('drops empty select values', () => {
    expect(orUndefined(null)).toBeUndefined();
    expect(orUndefined('')).toBeUndefined();
    expect(orUndefined('CH')).toBe('CH');
  });

  it('adds months keeping the day or the last day of a shorter month', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
  });

  it('splits a plan in equal monthly instalments, the leftover cents on the last one', () => {
    const rows = buildInstallments('100.00', 3, '2026-06-01');

    expect(rows.map((row) => row.due_date)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
    expect(rows.map((row) => row.amount)).toEqual(['33.33', '33.33', '33.34']);
    expect(sumDecimals(rows.map((row) => row.amount))).toBe('100.00');
    expect(buildInstallments('100.00', 0, '2026-06-01')).toEqual([]);
  });
});
