import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SalesWorkspaceApiService } from './sales-workspace-api.service';

describe('SalesWorkspaceApiService', () => {
  let api: SalesWorkspaceApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SalesWorkspaceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists orders with the tab filters as query parameters', () => {
    api.listOrders({ credit_blocked: true, status: 'on_hold', has_backorders: false }).subscribe();

    const request = http.expectOne((r) => r.url === `${environment.apiBaseUrl}/sales-orders`);
    expect(request.request.params.get('credit_blocked')).toBe('1');
    expect(request.request.params.get('status')).toBe('on_hold');
    expect(request.request.params.has('has_backorders')).toBe(false);
    request.flush({ data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } });
  });

  it('posts the lines of an ATP check with the default warehouse', () => {
    api.atpCheck([{ product_id: 'p1', quantity: 3 }], 'w1').subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/sales-orders/atp-check`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      lines: [{ product_id: 'p1', quantity: 3 }],
      warehouse_id: 'w1',
    });
    request.flush({ data: [] });
  });

  it('releases a credit block with the justification', () => {
    api.creditRelease('o1', 'Approved by finance').subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/sales-orders/o1/credit-release`);
    expect(request.request.body).toEqual({ notes: 'Approved by finance' });
    request.flush({ data: {} });
  });

  it('ships a partial DDT with the residual mode', () => {
    api.createDdt('o1', { lines: { l1: 4 }, residual_mode: 'backorder' }).subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/sales-orders/o1/create-ddt`);
    expect(request.request.body).toEqual({ lines: { l1: 4 }, residual_mode: 'backorder' });
    request.flush({ data: { id: 'd1' } });
  });

  it('calls off a blanket agreement', () => {
    api.callOff('a1', { lines: [{ blanket_agreement_line_id: 'al1', quantity: 5 }] }).subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/blanket-agreements/a1/call-off`);
    expect(request.request.method).toBe('POST');
    request.flush({ data: {} });
  });
});
