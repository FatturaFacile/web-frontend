import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_API_BASE_URL } from '../../../../../testing/api';
import { PagoPaNotice, TreasuryOpsApiService } from '@core';
import { environment } from '@env';
import { TrPagoPaNoticesComponent } from './tr-pagopa-notices.component';

function notice(overrides: Partial<PagoPaNotice> = {}): PagoPaNotice {
  return {
    id: 'n1',
    invoice_id: null,
    reference_type: null,
    reference_id: null,
    debtor_name: 'Mario Rossi',
    debtor_fiscal_code: null,
    amount: '122.00',
    currency: 'EUR',
    due_date: '2026-12-31',
    causale: 'Invoice 12',
    iuv: '0123456789012',
    notice_code: '302012345678901234',
    creditor_fiscal_code: '12345678901',
    status: 'pending',
    paid_at: null,
    ...overrides,
  };
}

describe('TrPagoPaNoticesComponent', () => {
  let http: HttpTestingController;
  const originalBase = environment.apiBaseUrl;

  beforeEach(async () => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    await TestBed.configureTestingModule({
      imports: [TrPagoPaNoticesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.apiBaseUrl = originalBase;
  });

  it('keeps the new-notice form invalid until the creditor fiscal code has 11 digits', () => {
    const component = TestBed.createComponent(TrPagoPaNoticesComponent).componentInstance as unknown as {
      form: TrPagoPaNoticesComponentForm;
    };
    component.form.patchValue({ debtor_name: 'Mario Rossi', amount: 10, due_date: '2026-12-31', causale: 'Fee', creditor_fiscal_code: '123' });
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ creditor_fiscal_code: '12345678901' });
    expect(component.form.valid).toBe(true);
  });

  it('calls the pagoPA notice endpoints of the treasury module', () => {
    const api = TestBed.inject(TreasuryOpsApiService);

    api.createPagoPaNotice({ debtor_name: 'Mario Rossi', amount: '122.00', due_date: '2026-12-31', causale: 'Fee', creditor_fiscal_code: '12345678901' }).subscribe();
    const create = http.expectOne(`${TEST_API_BASE_URL}/treasury/pagopa-notices`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toMatchObject({ amount: '122.00', creditor_fiscal_code: '12345678901' });
    create.flush({ success: true, message: '', data: notice() });

    api.cancelPagoPaNotice('n1').subscribe();
    expect(http.expectOne(`${TEST_API_BASE_URL}/treasury/pagopa-notices/n1/cancel`).request.method).toBe('POST');

    api.markPagoPaNoticePaid('n1').subscribe();
    expect(http.expectOne(`${TEST_API_BASE_URL}/treasury/pagopa-notices/n1/mark-paid`).request.method).toBe('POST');

    api.getPagoPaNoticeQrPayload('n1').subscribe();
    expect(http.expectOne(`${TEST_API_BASE_URL}/treasury/pagopa-notices/n1/qr-payload`).request.method).toBe('GET');
  });
});

interface TrPagoPaNoticesComponentForm {
  invalid: boolean;
  valid: boolean;
  patchValue(value: Record<string, unknown>): void;
}
