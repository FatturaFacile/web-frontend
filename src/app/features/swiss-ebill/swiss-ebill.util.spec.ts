import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  badgeColor,
  badgeKey,
  errorKey,
  failureOf,
  formatBytes,
  statusColor,
  timelineColor,
} from './swiss-ebill.util';

describe('swiss eBill util', () => {
  it('colours the statuses by outcome', () => {
    expect(statusColor('approved_by_debtor')).toBe('green');
    expect(statusColor('paid_reconciled')).toBe('green');
    expect(statusColor('rejected_by_debtor')).toBe('red');
    expect(statusColor('failed_technical')).toBe('red');
    expect(statusColor('delivered_to_ebanking')).toBe('blue');
    expect(statusColor('queued')).toBe('gold');
    expect(statusColor('draft')).toBe('default');
    expect(statusColor(null)).toBe('default');
    expect(timelineColor('cancelled')).toBe('gray');
    expect(timelineColor('transmitted')).toBe('blue');
  });

  it('tells the customer enrollment badge from the status and the channel', () => {
    expect(badgeKey('enrolled', 'b2b_enterprise')).toBe('active_b2b');
    expect(badgeKey('enrolled', 'b2c_private')).toBe('active_b2c');
    expect(badgeKey('enrolled', null)).toBe('active_b2c');
    expect(badgeKey('not_enrolled', null)).toBe('not_enrolled');
    expect(badgeKey('pending_opt_in', null)).toBe('pending_opt_in');
    expect(badgeKey('suspended', null)).toBe('suspended');
    expect(badgeKey('unknown', null)).toBe('not_verified');
    expect(badgeKey(undefined, null)).toBe('not_verified');
    expect(badgeColor('enrolled')).toBe('green');
    expect(badgeColor('suspended')).toBe('red');
    expect(badgeColor('unknown')).toBe('default');
  });

  it('turns an API refusal into a translation key and the pre-flight violations', () => {
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'payload_invalid',
          detail: 'Invoice cannot be sent',
          violations: [{ code: 'recipient_not_enrolled', field: 'contact' }],
        },
      }),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('swissEbill.error.payload_invalid');
    expect(outcome.detail).toBe('Invoice cannot be sent');
    expect(outcome.violations).toEqual([{ code: 'recipient_not_enrolled', field: 'contact' }]);
  });

  it('prefers the first field error and falls back to the unknown code', () => {
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { errors: { biller_id: ['Invalid biller id.'] } },
      }),
    );

    expect(outcome.detail).toBe('Invalid biller id.');
    expect(outcome.errorKey).toBe('swissEbill.error.unknown');
    expect(failureOf(new Error('boom')).errorKey).toBe(errorKey(null));
    expect(failureOf('nope').violations).toEqual([]);
  });

  it('formats the size of the courtesy PDF', () => {
    expect(formatBytes(null)).toBe('');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
