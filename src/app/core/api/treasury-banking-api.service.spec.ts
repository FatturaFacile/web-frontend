import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { emptyCsvMapping } from '../../features/treasury/operations/banking/treasury-banking.util';
import { TreasuryBankingApiService } from './treasury-banking-api.service';

describe('TreasuryBankingApiService', () => {
  let service: TreasuryBankingApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/treasury`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TreasuryBankingApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TreasuryBankingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('previews a payment file and creates the draft batch with the same payload', () => {
    const payload = {
      flow: 'cbi_sepa_03' as const,
      bank_account_id: 'b-1',
      execution_date: '2026-03-02',
      cuc: 'ABC12345',
      lines: [
        { recipient_name: 'Fornitore', recipient_iban: 'DE89370400440532013000', amount: '10.00' },
      ],
    };

    service.previewPaymentFlow(payload).subscribe();
    const preview = http.expectOne(`${base}/payment-flows/preview`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual(payload);
    preview.flush({ success: true, data: {} });

    service.createPaymentFlowBatch(payload).subscribe();
    http.expectOne(`${base}/payment-flows/batches`).flush({ success: true, data: {} });
  });

  it('lists the F24 tax codes of a section and manages a delegation through its lifecycle', () => {
    service.getF24TaxCodes('imu').subscribe();
    const codes = http.expectOne((r) => r.url === `${base}/f24/tax-codes`);
    expect(codes.request.params.get('section')).toBe('imu');
    codes.flush({ success: true, data: [] });

    service.validateF24Delegation('d-1').subscribe();
    expect(http.expectOne(`${base}/f24/delegations/d-1/validate`).request.method).toBe('POST');

    service.generateF24File('d-1').subscribe();
    expect(http.expectOne(`${base}/f24/delegations/d-1/generate`).request.method).toBe('POST');

    service.markF24Paid('d-1').subscribe();
    expect(http.expectOne(`${base}/f24/delegations/d-1/mark-paid`).request.method).toBe('POST');

    service.downloadF24File('d-1').subscribe();
    const download = http.expectOne(`${base}/f24/delegations/d-1/download`);
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['HD']));
  });

  it('uploads a CSV statement with the inline mapping as multipart form data', () => {
    const file = new File(['a;b'], 'extract.csv', { type: 'text/csv' });
    const csv = {
      ...emptyCsvMapping(),
      account_iban: 'IT60X0542811101000000123456',
      columns: { booking_date: 'Data', amount: 'Importo' },
    };

    service.importStatement(file, { format: 'csv', autoReconcile: false, csv }).subscribe();

    const req = http.expectOne(`${base}/statement-imports`);
    const body = req.request.body as FormData;
    expect(body.get('format')).toBe('csv');
    expect(body.get('auto_reconcile')).toBe('0');
    expect(body.get('csv[account_iban]')).toBe('IT60X0542811101000000123456');
    expect(body.get('csv[has_header]')).toBe('1');
    expect(body.get('csv[columns][booking_date]')).toBe('Data');
    expect(body.get('csv[columns][amount]')).toBe('Importo');
    expect(body.get('csv[columns][description]')).toBeNull();
    req.flush({ success: true, data: {} });
  });

  it('sends a saved profile id instead of a mapping, and no mapping for other formats', () => {
    const file = new File(['x'], 'extract.csv');
    service
      .importStatement(file, {
        format: 'csv',
        autoReconcile: true,
        csvProfileId: 'p-1',
        csv: emptyCsvMapping(),
      })
      .subscribe();
    const csvReq = http.expectOne(`${base}/statement-imports`);
    expect((csvReq.request.body as FormData).get('csv_profile_id')).toBe('p-1');
    expect((csvReq.request.body as FormData).get('csv[account_iban]')).toBeNull();
    csvReq.flush({ success: true, data: {} });

    service
      .importStatement(new File(['<x/>'], 'a.xml'), {
        format: 'auto',
        autoReconcile: true,
        csv: emptyCsvMapping(),
      })
      .subscribe();
    const xmlReq = http.expectOne(`${base}/statement-imports`);
    expect((xmlReq.request.body as FormData).get('csv[account_iban]')).toBeNull();
    xmlReq.flush({ success: true, data: {} });
  });

  it('synchronises an open banking connection for a period', () => {
    service.syncOpenBanking('c-1', { from: '2026-03-01', to: null }).subscribe();

    const req = http.expectOne(`${base}/open-banking/consents/c-1/sync`);
    expect(req.request.body).toEqual({ from: '2026-03-01', to: null });
    req.flush({ success: true, data: {} });

    service.getOpenBankingStatus().subscribe();
    http
      .expectOne(`${base}/open-banking/status`)
      .flush({ success: true, data: { driver: 'sandbox', available: true } });
  });

  it('queries the reconciliation workbench with its filters and drops the empty ones', () => {
    service
      .getSmartLines({
        status: 'open',
        direction: '',
        min_confidence: 95,
        statement_id: 's-1',
        with_proposals: true,
        page: 2,
        per_page: 25,
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${base}/smart-reconciliation/lines`);
    expect(req.request.params.get('status')).toBe('open');
    expect(req.request.params.get('min_confidence')).toBe('95');
    expect(req.request.params.get('statement_id')).toBe('s-1');
    expect(req.request.params.get('with_proposals')).toBe('1');
    expect(req.request.params.has('direction')).toBe(false);
    req.flush({ success: true, data: [], meta: {} });
  });

  it('applies, rejects and undoes proposals', () => {
    service.applyProposal('p-1').subscribe();
    expect(http.expectOne(`${base}/smart-reconciliation/proposals/p-1/apply`).request.method).toBe(
      'POST',
    );

    service.rejectProposal('p-1').subscribe();
    expect(http.expectOne(`${base}/smart-reconciliation/proposals/p-1/reject`).request.method).toBe(
      'POST',
    );

    service.unmatchSmartLine('l-1').subscribe();
    expect(http.expectOne(`${base}/smart-reconciliation/lines/l-1/unmatch`).request.method).toBe(
      'POST',
    );

    service.runSmartReconciliation('s-1', true).subscribe();
    const run = http.expectOne(`${base}/smart-reconciliation/run`);
    expect(run.request.body).toEqual({ statement_id: 's-1', auto_apply: true });
  });
});
