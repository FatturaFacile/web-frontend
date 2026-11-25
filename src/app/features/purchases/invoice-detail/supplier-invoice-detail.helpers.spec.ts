import { describe, expect, it } from 'vitest';
import {
  approvalStatusColor,
  invoiceDocumentTypeKey,
  isCreditNote,
  KNOWN_DOCUMENT_TYPES,
  paymentStatusColor,
} from './supplier-invoice-detail.helpers';

describe('supplier invoice detail helpers', () => {
  it('maps a known FatturaPA document type to its label and falls back to the generic invoice', () => {
    expect(invoiceDocumentTypeKey('TD04')).toBe('srm.invoice.documentType.TD04');
    expect(invoiceDocumentTypeKey('TD99')).toBe('srm.invoice.documentType.TD01');
    expect(invoiceDocumentTypeKey(null)).toBe('srm.invoice.documentType.TD01');
    expect(KNOWN_DOCUMENT_TYPES).toContain('TD17');
  });

  it('flags only TD04 as a credit note', () => {
    expect(isCreditNote('TD04')).toBe(true);
    expect(isCreditNote('TD01')).toBe(false);
    expect(isCreditNote(undefined)).toBe(false);
  });

  it('colours the payment status', () => {
    expect(paymentStatusColor('paid')).toBe('green');
    expect(paymentStatusColor('partially_paid')).toBe('orange');
    expect(paymentStatusColor('unpaid')).toBe('default');
    expect(paymentStatusColor(null)).toBe('default');
  });

  it('colours blocked and rejected approvals red and open ones orange', () => {
    expect(approvalStatusColor('match_blocked')).toBe('red');
    expect(approvalStatusColor('rejected')).toBe('red');
    expect(approvalStatusColor('in_approval')).toBe('orange');
    expect(approvalStatusColor('approved')).toBe('green');
    expect(approvalStatusColor('weird')).toBe('default');
  });
});
