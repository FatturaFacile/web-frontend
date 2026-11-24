import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReturnsRmaRequest, ReturnsSupplierReturnRequest } from '../models';
import { ReturnsApiService } from './returns-api.service';

describe('ReturnsApiService', () => {
  let service: ReturnsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReturnsApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ReturnsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the returns with the filters as query parameters and skips empty ones', () => {
    service.getRmas({ status: 'approved', search: 'RMA-2027', from: '' }).subscribe((response) => {
      expect(response.data).toEqual([]);
    });

    const request = httpMock.expectOne((r) => r.url.endsWith('/returns/rmas') && r.params.get('status') === 'approved' && r.params.get('search') === 'RMA-2027' && !r.params.has('from'));
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('creates a return with the API field names', () => {
    const payload: ReturnsRmaRequest = {
      contact_id: 'con-1',
      invoice_id: 'inv-1',
      reason_code: 'defective',
      lines: [{ invoice_item_id: 'item-1', quantity: 2, serial_number: 'SN-1' }],
    };

    service.createRma(payload).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/returns/rmas'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: {} });
  });

  it('posts every workflow step of a return to its own endpoint', () => {
    service.approveRma('r1', 'w1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/rmas/r1/approve')).request.body).toEqual({ warehouse_id: 'w1' });

    service.rejectRma('r1', 'Too late').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/rmas/r1/reject')).request.body).toEqual({ reason: 'Too late' });

    service.receiveRma('r1', { lines: [{ id: 'l1', quantity_received: 1 }] }).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/rmas/r1/receive')).request.body).toEqual({ lines: [{ id: 'l1', quantity_received: 1 }] });

    service.inspectRma('r1', [{ id: 'l1', disposition: 'restock' }]).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/rmas/r1/inspect')).request.body).toEqual({ lines: [{ id: 'l1', disposition: 'restock' }] });

    service.resolveRma('r1', { resolution_type: 'credit_note', credit_note_reference: 'CN-1' }).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/rmas/r1/resolve')).request.body).toEqual({ resolution_type: 'credit_note', credit_note_reference: 'CN-1' });

    service.closeRma('r1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/rmas/r1/close')).request.method).toBe('POST');
  });

  it('loads the returnable sources of a customer', () => {
    service.getSources('con-1').subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/returns/sources') && r.params.get('contact_id') === 'con-1');
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('filters the warranties that are expiring and sends booleans as 0/1', () => {
    service.getWarranties({ expiring: 30, expired: true, status: 'active' }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/returns/warranties') && r.params.get('expiring') === '30' && r.params.get('expired') === '1' && r.params.get('status') === 'active');
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('checks the validity of a warranty on a date and voids it with a reason', () => {
    service.checkWarrantyValidity('w1', '2028-02-01').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/warranties/w1/validity') && r.params.get('on') === '2028-02-01').flush({ data: {} });

    service.voidWarranty('w1', 'Mistake').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/warranties/w1/void')).request.body).toEqual({ reason: 'Mistake' });
  });

  it('accepts a claim with the override flag and resolves it', () => {
    service.acceptClaim('c1', { notes: 'Goodwill', override_validity: true }).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/claims/c1/accept')).request.body).toEqual({ notes: 'Goodwill', override_validity: true });

    service.resolveClaim('c1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/claims/c1/resolve')).request.method).toBe('POST');
  });

  it('drafts, ships, credits and closes a supplier return', () => {
    const payload: ReturnsSupplierReturnRequest = { supplier_id: 'sup-1', lines: [{ product_id: 'p1', quantity: 4, unit_cost: 12.5 }] };

    service.createSupplierReturn(payload).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/returns/supplier-returns')).request.body).toEqual(payload);

    service.shipSupplierReturn('s1', { carrier: 'DHL', tracking_number: 'TRK-1' }).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/supplier-returns/s1/ship')).request.body).toEqual({ carrier: 'DHL', tracking_number: 'TRK-1' });

    service.creditSupplierReturn('s1', 50).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/supplier-returns/s1/credit')).request.body).toEqual({ credit_received: 50 });

    service.closeSupplierReturn('s1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/supplier-returns/s1/close')).request.method).toBe('POST');

    service.cancelSupplierReturn('s2').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/supplier-returns/s2/cancel')).request.method).toBe('POST');
  });

  it('reads and changes the settings and the reason codes', () => {
    service.updateSettings(14).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/returns/settings') && r.method === 'PUT').request.body).toEqual({ return_window_days: 14 });

    service.getReasonCodes(true).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/returns/reason-codes') && r.params.get('active') === '1').flush({ data: [] });

    service.createReasonCode({ code: 'recalled', label: 'Product recall', is_defect: true }).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/returns/reason-codes') && r.method === 'POST').request.body).toEqual({ code: 'recalled', label: 'Product recall', is_defect: true });

    service.deleteReasonCode('rc1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/reason-codes/rc1')).request.method).toBe('DELETE');
  });

  it('loads the summary of a period', () => {
    service.getSummary({ from: '2027-01-01', to: '2027-12-31' }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/returns/summary') && r.params.get('from') === '2027-01-01' && r.params.get('to') === '2027-12-31');
    expect(request.request.method).toBe('GET');
    request.flush({ data: {} });
  });
});
