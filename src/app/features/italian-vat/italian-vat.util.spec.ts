import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { CuCertification, F24Payment, LipeCommunication, PlafondRow } from '@core';
import {
  annualCanFinalize,
  annualNetPosition,
  basisTotal,
  blockedDeclarations,
  cuCanIssue,
  cuInvalid,
  f24Outstanding,
  f24Unpaid,
  lipeActions,
  plafondRevocable,
  plafondUsage,
  problemIssue,
  problemKey,
  toCents,
  validateDeclaration,
  validTransmissionProtocol,
  ventilationIssues,
} from './italian-vat.util';

const row = (overrides: Partial<PlafondRow> = {}): PlafondRow => ({
  id: 'd1',
  contact_id: 'c1',
  contact_name: 'Export Srl',
  protocol_number: '12345678901234567-000001',
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  plafond: '10000.00',
  consumed: '2500.00',
  residual: '7500.00',
  usage_percentage: '25.00',
  status: 'active',
  alert: 'ok',
  days_to_expiry: 100,
  ...overrides,
});

const lipe = (overrides: Partial<LipeCommunication> = {}): LipeCommunication => ({
  id: 'l1',
  year: 2026,
  quarter: 1,
  status: 'validated',
  settlement_ids: [],
  totals: {
    active_operations: '0.00',
    passive_operations: '0.00',
    output_vat: '0.00',
    input_vat: '0.00',
    difference: '0.00',
    previous_debit: '0.00',
    previous_credit: '0.00',
    interest: '0.00',
    balance: '0.00',
  },
  file_name: 'IT01234567890_LI_26T01.xml',
  xsd_errors: [],
  reconciliation_status: 'balanced',
  reconciliation: null,
  signature_status: 'unsigned',
  signature_digest: null,
  signer_fingerprint: null,
  signed_at: null,
  transmission_protocol: null,
  transmitted_at: null,
  rejection_reason: null,
  ...overrides,
});

const cu = (overrides: Partial<CuCertification> = {}): CuCertification => ({
  id: 'c1',
  year: 2025,
  supplier_id: null,
  recipient_name: 'Mario Rossi',
  recipient_tax_code: 'RSSMRA80A01H501U',
  recipient_vat_number: null,
  recipient_kind: 'professional',
  reason_code: 'A',
  gross_amount: '1000.00',
  non_taxable_amount: '0.00',
  taxable_amount: '1000.00',
  withheld_amount: '200.00',
  contributions_amount: '0.00',
  payments_count: 1,
  status: 'validated',
  validation_errors: null,
  issued_at: null,
  ...overrides,
});

const f24 = (overrides: Partial<F24Payment> = {}): F24Payment => ({
  id: 'f1',
  year: 2025,
  month: 3,
  tax_code: '1040',
  amount_due: '200.00',
  amount_paid: '50.00',
  due_date: '2025-04-16',
  paid_at: null,
  f24_reference: null,
  withholding_settlement_id: null,
  status: 'partial',
  ...overrides,
});

describe('plafond helpers', () => {
  it('caps and parses the usage percentage', () => {
    expect(plafondUsage(row())).toBe(25);
    expect(plafondUsage(row({ usage_percentage: '130.00' }))).toBe(100);
    expect(plafondUsage(row({ usage_percentage: 'x' }))).toBe(0);
  });

  it('flags declarations that cannot cover VAT-free operations', () => {
    const rows = [
      row(),
      row({ id: 'd2', status: 'expired' }),
      row({ id: 'd3', status: 'exhausted' }),
      row({ id: 'd4', status: 'revoked' }),
      row({ id: 'd5', status: 'not_yet_valid' }),
    ];
    expect(blockedDeclarations(rows).map((r) => r.id)).toEqual(['d2', 'd3', 'd4', 'd5']);
  });

  it('allows revoking only active or upcoming declarations', () => {
    expect(plafondRevocable(row())).toBe(true);
    expect(plafondRevocable(row({ status: 'not_yet_valid' }))).toBe(true);
    expect(plafondRevocable(row({ status: 'revoked' }))).toBe(false);
    expect(plafondRevocable(row({ status: 'expired' }))).toBe(false);
  });

  it('validates the declaration form like the backend', () => {
    const valid = {
      protocol_number: '12345678901234567-000001',
      receipt_date: '2026-01-02',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      plafond_amount: 100,
    };
    expect(validateDeclaration(valid)).toEqual([]);
    expect(validateDeclaration({ ...valid, protocol_number: '12345678901234567' })).toEqual([]);
    expect(validateDeclaration({ ...valid, protocol_number: '123' })).toContain('protocol_format');
    expect(validateDeclaration({ ...valid, valid_to: '2025-12-31' })).toContain('dates_order');
    expect(validateDeclaration({ ...valid, receipt_date: '2027-01-01' })).toContain(
      'protocol_after_validity',
    );
    expect(validateDeclaration({ ...valid, plafond_amount: 0 })).toContain('plafond_not_positive');
  });
});

describe('ventilation helpers', () => {
  it('sums the purchase basis in cents', () => {
    expect(
      basisTotal([
        { rate: '22', amount: '0.10' },
        { rate: '10', amount: '0.20' },
      ]),
    ).toBe('0.30');
    expect(toCents('0.1') + toCents('0.2')).toBe(30);
  });

  it('requires takings, a basis and the nature of zero-rate lines', () => {
    expect(ventilationIssues('100.00', [{ rate: '22', amount: '50.00' }])).toEqual([]);
    expect(ventilationIssues('0', [{ rate: '22', amount: '50.00' }])).toEqual(['gross']);
    expect(ventilationIssues('100.00', [{ rate: '22', amount: '0' }])).toEqual(['basis']);
    expect(ventilationIssues('100.00', [])).toEqual(['basis']);
    expect(ventilationIssues('100.00', [{ rate: '0', amount: '10.00' }])).toEqual(['nature']);
    expect(ventilationIssues('100.00', [{ rate: '0', amount: '10.00', nature: 'N2.1' }])).toEqual(
      [],
    );
  });
});

describe('LIPE status flow', () => {
  it('offers signing only on a validated communication without XSD errors', () => {
    expect(lipeActions(lipe()).sign).toBe(true);
    expect(lipeActions(lipe({ xsd_errors: ['VP9'] })).sign).toBe(false);
    expect(lipeActions(lipe({ xsd_errors: ['VP9'] })).download).toBe(false);
    expect(lipeActions(lipe({ status: 'draft' })).sign).toBe(false);
  });

  it('marks ready only when signed and reconciled', () => {
    const signed = lipe({ status: 'signed', signature_status: 'signed' });
    expect(lipeActions(signed).markReady).toBe(true);
    expect(lipeActions({ ...signed, reconciliation_status: 'unbalanced' }).markReady).toBe(false);
    expect(lipeActions({ ...signed, signature_status: 'invalid' }).markReady).toBe(false);
  });

  it('transmits a ready communication and allows a rejection once ready or transmitted', () => {
    expect(lipeActions(lipe({ status: 'ready' })).transmit).toBe(true);
    expect(lipeActions(lipe({ status: 'ready' })).reject).toBe(true);
    expect(lipeActions(lipe({ status: 'transmitted' })).reject).toBe(true);
    expect(lipeActions(lipe({ status: 'transmitted' })).reconcile).toBe(false);
    expect(lipeActions(lipe()).transmit).toBe(false);
  });

  it('validates the transmission protocol', () => {
    expect(validTransmissionProtocol('12345678901234567')).toBe(true);
    expect(validTransmissionProtocol(' 12345678901234567/000001 ')).toBe(true);
    expect(validTransmissionProtocol('1234')).toBe(false);
  });
});

describe('annual VAT', () => {
  it('can be finalised only when reconciled and still open', () => {
    expect(annualCanFinalize(null)).toBe(false);
    expect(annualCanFinalize({ is_reconciled: true, finalized_at: null })).toBe(true);
    expect(annualCanFinalize({ is_reconciled: false, finalized_at: null })).toBe(false);
    expect(annualCanFinalize({ is_reconciled: true, finalized_at: '2026-02-01T00:00:00Z' })).toBe(
      false,
    );
  });

  it('computes the net position as debit minus credit', () => {
    expect(annualNetPosition({ annual_debit: '300.00', annual_credit: '0.00' })).toBe('300.00');
    expect(annualNetPosition({ annual_debit: '0.00', annual_credit: '120.50' })).toBe('-120.50');
  });
});

describe('Certificazione Unica and F24', () => {
  it('issues only when every pending certification is validated', () => {
    expect(cuCanIssue([cu(), cu({ id: 'c2' })])).toBe(true);
    expect(cuCanIssue([cu(), cu({ id: 'c2', status: 'draft' })])).toBe(false);
    expect(cuCanIssue([cu({ status: 'issued' })])).toBe(false);
    expect(cuCanIssue([])).toBe(false);
  });

  it('lists certifications with validation errors', () => {
    expect(
      cuInvalid([
        cu(),
        cu({ id: 'c2', status: 'draft', validation_errors: ['cu_tax_code_missing'] }),
      ]).map((c) => c.id),
    ).toEqual(['c2']);
  });

  it('computes the outstanding F24 amount and the unpaid ones', () => {
    expect(f24Outstanding(f24())).toBe('150.00');
    expect(f24Outstanding(f24({ amount_paid: '250.00' }))).toBe('0.00');
    expect(
      f24Unpaid([f24(), f24({ id: 'f2', amount_paid: '200.00', status: 'paid' })]).map((p) => p.id),
    ).toEqual(['f1']);
  });
});

describe('problem details', () => {
  it('reads the stable code of a rule violation', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { invalid_params: [{ code: 'plafond_exceeded', params: { residual: '10.00' } }] },
    });
    const issue = problemIssue(error);
    expect(issue).toEqual({ code: 'plafond_exceeded', params: { residual: '10.00' } });
    expect(problemKey(issue!)).toBe('italianVat.error.plafond_exceeded');
  });

  it('ignores any other failure', () => {
    expect(problemIssue(new HttpErrorResponse({ status: 500, error: {} }))).toBeNull();
    expect(problemIssue(new Error('x'))).toBeNull();
  });
});
