import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { PayablesApiService } from './payables-api.service';

describe('PayablesApiService', () => {
  let service: PayablesApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/accounting/payables`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PayablesApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PayablesApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the items, sending the booleans as 1 / 0 and dropping empty values', () => {
    service
      .listItems({
        supplier_id: 's-1',
        status: 'blocked',
        skonto_only: true,
        open_only: false,
        search: '',
        page: 2,
      })
      .subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/items`);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('supplier_id')).toBe('s-1');
    expect(request.request.params.get('status')).toBe('blocked');
    expect(request.request.params.get('skonto_only')).toBe('1');
    expect(request.request.params.get('open_only')).toBe('0');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.has('search')).toBe(false);
    request.flush({ data: [], meta: {} });
  });

  it('loads the summary, one item and the currency filter only when set', () => {
    service.getItemSummary('CHF').subscribe();
    const summary = httpTesting.expectOne((req) => req.url === `${base}/items/summary`);
    expect(summary.request.params.get('currency')).toBe('CHF');
    summary.flush({ data: {} });

    service.getItem('i-1').subscribe();
    httpTesting.expectOne(`${base}/items/i-1`).flush({ data: {} });
  });

  it('places an item in dispute or block and releases it with a reason', () => {
    service.block('i-1', { kind: 'dispute', reason: 'wrong price' }).subscribe();
    const block = httpTesting.expectOne(`${base}/items/i-1/block`);
    expect(block.request.method).toBe('POST');
    expect(block.request.body).toEqual({ kind: 'dispute', reason: 'wrong price' });
    block.flush({ data: {} });

    service.release('i-1', { reason: 'solved' }).subscribe();
    const release = httpTesting.expectOne(`${base}/items/i-1/release`);
    expect(release.request.method).toBe('POST');
    expect(release.request.body).toEqual({ reason: 'solved' });
    release.flush({ data: {} });
  });

  it('previews and creates a batch', () => {
    service
      .previewBatch({
        cutoff_date: '2026-04-15',
        prioritize_skonto: true,
        item_ids: ['i-1'],
        set_off_ids: [],
      })
      .subscribe();
    const preview = httpTesting.expectOne(`${base}/batches/preview`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({
      cutoff_date: '2026-04-15',
      prioritize_skonto: true,
      item_ids: ['i-1'],
      set_off_ids: [],
    });
    preview.flush({ data: {} });

    service
      .createBatch({
        cutoff_date: '2026-04-15',
        prioritize_skonto: true,
        item_ids: ['i-1'],
        set_off_ids: ['cn-1'],
      })
      .subscribe();
    const create = httpTesting.expectOne(`${base}/batches`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.set_off_ids).toEqual(['cn-1']);
    create.flush({ data: {} });
  });

  it('lists batches by status', () => {
    service.listBatches({ status: 'approved', page: 1 }).subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/batches`);
    expect(request.request.params.get('status')).toBe('approved');
    request.flush({ data: [], meta: {} });
  });

  it('walks the approval workflow', () => {
    service.submitBatch('b-1').subscribe();
    expect(httpTesting.expectOne(`${base}/batches/b-1/submit`).request.method).toBe('POST');
    httpTesting.expectOne(`${base}/batches/b-1/submit`).flush({ data: {} });
  });

  it('approves, rejects, executes and cancels a batch', () => {
    service.approveBatch('b-1').subscribe();
    const approve = httpTesting.expectOne(`${base}/batches/b-1/approve`);
    expect(approve.request.body).toEqual({});
    approve.flush({ data: {} });

    service.rejectBatch('b-1', { reason: 'no cash' }).subscribe();
    const reject = httpTesting.expectOne(`${base}/batches/b-1/reject`);
    expect(reject.request.body).toEqual({ reason: 'no cash' });
    reject.flush({ data: {} });

    service.executeBatch('b-1').subscribe();
    httpTesting.expectOne(`${base}/batches/b-1/execute`).flush({ data: {} });

    service.cancelBatch('b-1').subscribe();
    httpTesting.expectOne(`${base}/batches/b-1/cancel`).flush({ data: {} });
  });

  it('asks the aging of a date and currency', () => {
    service.getAging({ as_of: '2026-04-01', currency: 'EUR' }).subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/aging`);
    expect(request.request.params.get('as_of')).toBe('2026-04-01');
    expect(request.request.params.get('currency')).toBe('EUR');
    request.flush({ data: {} });
  });

  it('downloads the aging as Excel and PDF blobs', () => {
    service.exportAging('xlsx', { as_of: '2026-04-01' }).subscribe();
    const xlsx = httpTesting.expectOne((req) => req.url === `${base}/aging/export/xlsx`);
    expect(xlsx.request.responseType).toBe('blob');
    expect(xlsx.request.params.get('as_of')).toBe('2026-04-01');
    xlsx.flush(new Blob(['x']));

    service.exportAging('pdf').subscribe();
    const pdf = httpTesting.expectOne((req) => req.url === `${base}/aging/export/pdf`);
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['x']));
  });
});
