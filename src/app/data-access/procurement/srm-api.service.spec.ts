import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentFlow, SrmDashboard, SupplierRating } from '@domain/procurement/srm.models';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_API_BASE_URL } from '../../../testing/api';
import { SrmApiService } from './srm-api.service';

describe('SrmApiService', () => {
  const base = `${TEST_API_BASE_URL}/procurement`;
  const originalApiBaseUrl = environment.apiBaseUrl;
  let api: SrmApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SrmApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('loads the dashboard of a period and unwraps the data envelope', () => {
    let result: SrmDashboard | undefined;
    api.dashboard({ from: '2026-01-01', to: '2026-06-30' }).subscribe((d) => (result = d));

    const req = http.expectOne((r) => r.url === `${base}/srm/dashboard`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-06-30');
    req.flush({ data: { orders: { open: 3 } } });

    expect(result?.orders.open).toBe(3);
  });

  it('omits the period parameters when none is given', () => {
    api.dashboard().subscribe();

    const req = http.expectOne((r) => r.url === `${base}/srm/dashboard`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ data: {} });
  });

  it('loads the ranking and defaults to an empty list', () => {
    let ratings: SupplierRating[] | undefined;
    api.scorecards().subscribe((r) => (ratings = r));

    http.expectOne((r) => r.url === `${base}/srm/scorecards`).flush({ data: null });

    expect(ratings).toEqual([]);
  });

  it('loads the composite scorecard of one supplier', () => {
    let tier: string | null | undefined;
    api.supplierScorecard('s-1', { from: '2026-01-01' }).subscribe((r) => (tier = r.tier));

    const req = http.expectOne((r) => r.url === `${base}/suppliers/s-1/srm-scorecard`);
    expect(req.request.params.get('from')).toBe('2026-01-01');
    req.flush({ data: { tier: 'B' } });

    expect(tier).toBe('B');
  });

  it('loads the document flow of a document', () => {
    let flow: DocumentFlow | undefined;
    api.documentFlow('purchase_order', 'po-1').subscribe((f) => (flow = f));

    const req = http.expectOne(`${base}/document-flow/purchase_order/po-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { anchor: { type: 'purchase_order', id: 'po-1' }, nodes: [], edges: [] } });

    expect(flow?.anchor.id).toBe('po-1');
  });
});
