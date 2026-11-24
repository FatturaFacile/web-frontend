import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { EquipmentPassport, Loaner, RmaOrder, SerialLookupResult, VendorClaim } from '@core';

/** Test fixtures for the warranty/RMA feature specs (not used by application code). */

export function httpError(status: number, body: object = {}): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body }));
}

export function rmaFixture(overrides: Partial<RmaOrder> = {}): RmaOrder {
  return {
    id: 'rma-1',
    rma_number: 'RMA-2026-000123',
    status: 'in_diagnosis',
    warranty_status: 'out_of_warranty_billable',
    equipment_passport_id: 'pp-1',
    serial_number: 'SN123',
    customer_id: 'c-1',
    customer: { id: 'c-1', name: 'ACME SA' },
    reported_symptom: 'No power',
    received_at: null,
    receipt_condition_notes: null,
    receipt_photos: [],
    lab_bench_diagnostic_notes: null,
    estimate: {
      labour_total: '0.00',
      parts_total: '0.00',
      total: '0.00',
      currency: 'CHF',
      preauthorized_threshold: '100.00',
      approval_status: 'not_required',
      decided_at: null,
      decided_via: null,
      expires_at: null,
    },
    lines: [],
    loaner: null,
    ddt: {
      causale_outbound: 'conto_riparazione',
      causale_return: null,
      is_non_ownership_transfer: true,
      vat_exempt_art15_dpr633: false,
    },
    repair_outcome: null,
    vendor_claims: [],
    history: [],
    returned_at: null,
    closed_at: null,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export function passportFixture(overrides: Partial<EquipmentPassport> = {}): EquipmentPassport {
  return {
    id: 'pp-1',
    serial_number: 'SN123',
    stock_serial_number_id: null,
    product_id: null,
    current_owner_customer_id: 'c-1',
    customer: { id: 'c-1', name: 'ACME SA', country: 'CH' },
    original_sales_invoice_id: null,
    customer_type: 'b2c',
    jurisdiction: 'CH',
    delivery_date: '2025-03-10',
    warranty_policy_type: 'statutory_ch_24m',
    warranty_start_date: '2025-03-10',
    warranty_expiry_date: '2027-03-10',
    warranty_source: 'statutory',
    contract_warranty_months: null,
    contract_clause_reference: null,
    installed_firmware_version: '1.2.3',
    extensions: [],
    components: [],
    created_at: '2025-03-10T00:00:00Z',
    updated_at: '2025-03-10T00:00:00Z',
    ...overrides,
  };
}

export function lookupFixture(overrides: Partial<SerialLookupResult> = {}): SerialLookupResult {
  return {
    passport: passportFixture(),
    warranty: {
      status: 'in_warranty',
      start_date: '2025-03-10',
      expiry_date: '2027-03-10',
      days_remaining: 120,
      policy_type: 'statutory_ch_24m',
      basis: { jurisdiction: 'CH', customer_type: 'b2c', months: 24, source: 'statutory' },
    },
    rma_history: [
      {
        id: 'rma-0',
        rma_number: 'RMA-2026-000100',
        status: 'closed',
        created_at: '2026-01-10T00:00:00Z',
      },
    ],
    stock_hint: null,
    ...overrides,
  };
}

export function loanerFixture(overrides: Partial<Loaner> = {}): Loaner {
  return {
    id: 'ln-1',
    rma_order_id: 'rma-1',
    loaner_serial_number: 'LOAN-1',
    loaner_stock_serial_number_id: null,
    loaner_product_id: null,
    customer_id: 'c-1',
    register_type: 'prestito_uso',
    issued_at: '2026-10-01T00:00:00Z',
    expected_return_at: null,
    returned_at: null,
    status: 'issued',
    ddt_causale: 'prestito_uso',
    is_overdue: false,
    days_outstanding: 5,
    ...overrides,
  };
}

export function vendorClaimFixture(overrides: Partial<VendorClaim> = {}): VendorClaim {
  return {
    id: 'vc-1',
    rma_order_id: 'rma-1',
    rma_number: 'RMA-2026-000123',
    original_supplier_id: 's-1',
    supplier: { id: 's-1', name: 'Parts AG' },
    defective_part_serial: 'PSU-9',
    defective_product_id: null,
    supplier_rma_reference: null,
    status: 'draft',
    claimed_amount: '40.00',
    credit_note_reference: null,
    resolved_at: null,
    notes: null,
    ...overrides,
  };
}

/** Minimal I18nService double: keys are returned untranslated (params appended for assertions). */
export function i18nStub() {
  return {
    currentLanguage: signal<'en' | 'it' | 'de' | 'fr'>('en'),
    languages: [{ code: 'en', label: 'English', flag: '' }],
    translate: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    instant: (key: string) => key,
    setLanguage: () => Promise.resolve({}),
  };
}
