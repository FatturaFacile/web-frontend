import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  allowedRmaActions,
  canIssueLoaner,
  esmErrorCode,
  estimateApprovalTag,
  isLoanerOverdue,
  nextVendorClaimStatuses,
  requiresCreditNoteReference,
  rmaStatusLabelKey,
  rmaStatusTag,
  toAmount,
  warrantyStatusTag,
} from './rma-status';

describe('rma-status utils', () => {
  it('maps each status to the actions of the backend state machine', () => {
    expect(allowedRmaActions('awaiting_arrival')).toEqual(['receive', 'cancel']);
    expect(allowedRmaActions('in_diagnosis')).toEqual(['diagnosis', 'cancel']);
    expect(allowedRmaActions('awaiting_estimate_approval')).toEqual([
      'approve_estimate',
      'decline_estimate',
      'resend_estimate',
    ]);
    expect(allowedRmaActions('awaiting_parts')).toEqual(['parts_received']);
    expect(allowedRmaActions('in_repair_testing')).toEqual(['complete_repair']);
    expect(allowedRmaActions('ready_for_return')).toEqual(['return']);
    expect(allowedRmaActions('returned')).toEqual(['close']);
    expect(allowedRmaActions('closed')).toEqual([]);
    expect(allowedRmaActions('cancelled')).toEqual([]);
  });

  it('offers no action for unknown future statuses', () => {
    expect(allowedRmaActions('on_hold')).toEqual([]);
    expect(rmaStatusLabelKey('on_hold')).toBe('on_hold');
    expect(rmaStatusTag('on_hold').icon).toContain('fa-');
  });

  it('builds i18n keys and always pairs colour with an icon', () => {
    expect(rmaStatusLabelKey('in_diagnosis')).toBe('RMA.STATUS.IN_DIAGNOSIS');
    const tag = warrantyStatusTag('covered_in_warranty');
    expect(tag.labelKey).toBe('RMA.WARRANTY_STATUS.COVERED_IN_WARRANTY');
    expect(tag.icon).toBeTruthy();
    expect(estimateApprovalTag(null)).toBeNull();
    expect(estimateApprovalTag('pending_customer_approval')?.labelKey).toBe(
      'RMA.ESTIMATE_STATUS.PENDING_CUSTOMER_APPROVAL',
    );
  });

  it('offers only legal vendor claim transitions', () => {
    expect(nextVendorClaimStatuses('draft')).toEqual(['submitted']);
    expect(nextVendorClaimStatuses('acknowledged')).toEqual([
      'approved_credit_note',
      'approved_replacement',
      'rejected',
    ]);
    expect(nextVendorClaimStatuses('closed')).toEqual([]);
    expect(requiresCreditNoteReference('approved_credit_note')).toBe(true);
    expect(requiresCreditNoteReference('rejected')).toBe(false);
  });

  it('flags a loaner overdue only while issued', () => {
    expect(isLoanerOverdue({ status: 'issued', is_overdue: true })).toBe(true);
    expect(isLoanerOverdue({ status: 'returned', is_overdue: true })).toBe(false);
    expect(isLoanerOverdue(null)).toBe(false);
  });

  it('allows issuing a loaner only while the unit is in the depot without an active loaner', () => {
    expect(canIssueLoaner({ status: 'in_diagnosis', loaner: null })).toBe(true);
    expect(canIssueLoaner({ status: 'returned', loaner: null })).toBe(false);
  });

  it('reads the ESM error code and decimal strings', () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { message: 'x', code: 'invalid_transition' },
    });
    expect(esmErrorCode(err)).toBe('invalid_transition');
    expect(esmErrorCode(new Error('x'))).toBeNull();
    expect(toAmount('12.50')).toBe(12.5);
    expect(toAmount(null)).toBeNull();
    expect(toAmount('abc')).toBeNull();
  });
});
