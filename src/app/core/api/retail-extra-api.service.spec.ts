import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { RetailExtraApiService } from './retail-extra-api.service';

describe('RetailExtraApiService', () => {
  let api: RetailExtraApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/fiscal-retail`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(RetailExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  function expectCall(method: string, path: string, body?: unknown): void {
    const req = http.expectOne((r) => r.url === `${base}${path}`);
    expect(req.request.method).toBe(method);
    if (body !== undefined) {
      expect(req.request.body).toEqual(body);
    }
    req.flush(req.request.responseType === 'blob' ? new Blob(['x']) : { data: {} });
  }

  it('handles commercial documents and corrispettivi', () => {
    api.retransmitDocument('d1').subscribe();
    expectCall('POST', '/commercial-documents/d1/retransmit', {});
    api.returnDocument('d1', [{ line_id: 'l', quantity: 1 }]).subscribe();
    expectCall('POST', '/commercial-documents/d1/return', { lines: [{ line_id: 'l', quantity: 1 }] });
    api.closeCorrispettiviDay('2026-11-01').subscribe();
    expectCall('POST', '/corrispettivi/daily/2026-11-01/close', {});
  });

  it('manages promotions', () => {
    api.getPromotions().subscribe();
    expectCall('GET', '/pos/promotions');
    api.getPromotion('p1').subscribe();
    expectCall('GET', '/pos/promotions/p1');
    api.createPromotion({ code: 'A', name: 'A', type: 'percentage', value: 10 }).subscribe();
    expectCall('POST', '/pos/promotions');
    api.updatePromotion('p1', { name: 'B' }).subscribe();
    expectCall('PUT', '/pos/promotions/p1', { name: 'B' });
    api.deletePromotion('p1').subscribe();
    expectCall('DELETE', '/pos/promotions/p1');
  });

  it('handles cash movements, reports and returns', () => {
    api.getCashMovements('s1').subscribe();
    expectCall('GET', '/pos/sessions/s1/cash-movements');
    api.addCashMovement('s1', { type: 'pay_in', amount: 5 }).subscribe();
    expectCall('POST', '/pos/sessions/s1/cash-movements', { type: 'pay_in', amount: 5 });
    api.getXReport('s1').subscribe();
    expectCall('GET', '/pos/sessions/s1/x-report');
    api.getZReport('s1').subscribe();
    expectCall('GET', '/pos/sessions/s1/z-report');
    api.getZReports().subscribe();
    expectCall('GET', '/pos/z-reports');
    api.getCorrispettiviRegister(2026, 11).subscribe();
    expectCall('GET', '/corrispettivi/register');
    api.getReturns().subscribe();
    expectCall('GET', '/pos/returns');
    api.getReturn('r1').subscribe();
    expectCall('GET', '/pos/returns/r1');
  });
});
