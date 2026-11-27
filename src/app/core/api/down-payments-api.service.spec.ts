import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { dpChain, dpPlanPreview } from '../../../testing/down-payments-fixtures';
import { DownPaymentsApiService } from './down-payments-api.service';

describe('DownPaymentsApiService', () => {
  let api: DownPaymentsApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/down-payment-chains`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DownPaymentsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('reads the presets of the wizard', () => {
    let presets: string[] = [];
    api.getLookups().subscribe((response) => (presets = Object.keys(response.data.presets)));

    const request = http.expectOne(`${base}/lookups`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: '', data: { presets: { '50_50': [] } } });

    expect(presets).toEqual(['50_50']);
  });

  it('lists the chains with the filters as query parameters, dropping the empty ones', () => {
    api
      .listChains({
        customer_id: 'cust1',
        status: 'active',
        source_type: 'quote',
        source_id: '',
        country: 'CH',
        page: 2,
      })
      .subscribe();

    const request = http.expectOne((req) => req.url === base);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('customer_id')).toBe('cust1');
    expect(request.request.params.get('status')).toBe('active');
    expect(request.request.params.get('source_type')).toBe('quote');
    expect(request.request.params.get('country')).toBe('CH');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.has('source_id')).toBe(false);
    request.flush({ success: true, message: '', data: [], meta: { total: 0 } });
  });

  it('unwraps the envelope of a chain', () => {
    let number = '';
    api.getChain('c1').subscribe((response) => (number = response.data.chain_number));

    const request = http.expectOne(`${base}/c1`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: '', data: dpChain() });

    expect(number).toBe('DPC-2026-1');
  });

  it('previews a plan and opens the chain from the source', () => {
    const payload = { source_type: 'sales_order' as const, source_id: 'so1', template: '50_50' };

    api.previewPlan(payload).subscribe();
    const preview = http.expectOne(`${base}/preview-plan`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual(payload);
    preview.flush({ success: true, message: '', data: dpPlanPreview() });

    api.createFromSource({ ...payload, notes: 'n' }).subscribe();
    const create = http.expectOne(`${base}/from-source`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ ...payload, notes: 'n' });
    create.flush({ success: true, message: '', data: dpChain() });
  });

  it('cancels a chain and emits an installment', () => {
    api.cancelChain('c1').subscribe();
    http.expectOne(`${base}/c1/cancel`).flush({ success: true, message: '', data: dpChain() });

    api.emitInstallment('c1', 'i1', { date: '2026-12-01' }).subscribe();
    const emit = http.expectOne(`${base}/c1/installments/i1/emit`);
    expect(emit.request.method).toBe('POST');
    expect(emit.request.body).toEqual({ date: '2026-12-01' });
    emit.flush({
      success: true,
      message: '',
      data: { instrument: 'advance_invoice_immediate', chain: dpChain() },
    });
  });

  it('confirms the payment of a pro-forma and of a deposit receipt', () => {
    api
      .confirmProformaPayment('c1', 'l1', { paid_at: '2026-12-05', payment_account: 'bank' })
      .subscribe();
    const proforma = http.expectOne(`${base}/c1/proforma/l1/confirm-payment`);
    expect(proforma.request.body).toEqual({ paid_at: '2026-12-05', payment_account: 'bank' });
    proforma.flush({ success: true, message: '', data: dpChain() });

    api.confirmDepositPayment('c1', 'd1', { paid_at: '2026-12-05' }).subscribe();
    const deposit = http.expectOne(`${base}/c1/deposits/d1/confirm-payment`);
    expect(deposit.request.body).toEqual({ paid_at: '2026-12-05' });
    deposit.flush({ success: true, message: '', data: {} });
  });

  it('previews and resolves a deposit', () => {
    const payload = { resolution: 'refund' as const, refund_mode: 'double' as const };

    api.previewDepositResolution('c1', 'd1', payload).subscribe();
    const preview = http.expectOne(`${base}/c1/deposits/d1/preview-resolution`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual(payload);
    preview.flush({
      success: true,
      message: '',
      data: { resolution: 'refund', vat_applies: false, lines: [], penalty_amount: '500.00' },
    });

    api.resolveDeposit('c1', 'd1', payload).subscribe();
    const resolve = http.expectOne(`${base}/c1/deposits/d1/resolve`);
    expect(resolve.request.body).toEqual(payload);
    resolve.flush({ success: true, message: '', data: dpChain() });
  });

  it('previews and generates the final settlement', () => {
    api.previewFinalSettlement('c1').subscribe();
    const preview = http.expectOne(`${base}/c1/preview-final-settlement`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({});
    preview.flush({ success: true, message: '', data: {} });

    let invoice = '';
    api
      .generateFinalSettlement('c1', { document_type: 'TD24', impute_deposit_ids: ['d1'] })
      .subscribe((response) => (invoice = response.data.invoice_number));
    const generate = http.expectOne(`${base}/c1/generate-final-settlement`);
    expect(generate.request.body).toEqual({ document_type: 'TD24', impute_deposit_ids: ['d1'] });
    generate.flush({
      success: true,
      message: '',
      data: { invoice_id: 'f1', invoice_number: 'F-1', chain: dpChain() },
    });

    expect(invoice).toBe('F-1');
  });

  it('previews and issues the credit note of an advance', () => {
    const payload = { mode: 'lines' as const, lines: [{ vat_rate: '22.00', net: '100.00' }] };

    api.previewCreditNote('c1', 'l1', payload).subscribe();
    const preview = http.expectOne(`${base}/c1/links/l1/credit-note/preview`);
    expect(preview.request.body).toEqual(payload);
    preview.flush({ success: true, message: '', data: {} });

    api.issueCreditNote('c1', 'l1', { ...payload, reason: 'Order reduced' }).subscribe();
    const issue = http.expectOne(`${base}/c1/links/l1/credit-note`);
    expect(issue.request.method).toBe('POST');
    expect(issue.request.body).toEqual({ ...payload, reason: 'Order reduced' });
    issue.flush({
      success: true,
      message: '',
      data: { credit_note_id: 'n1', credit_note_number: 'NC-1', chain: dpChain() },
    });
  });
});
