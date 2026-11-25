import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentFlow, SrmDashboard, SupplierRatingPage } from '@domain/procurement/srm.models';
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

  it('loads one server-side page of the ranking with filters, sort and page', () => {
    let page: SupplierRatingPage | undefined;
    api
      .scorecards({
        search: 'alfa',
        tier: 'A',
        sort: 'on_time_delivery_rate',
        direction: 'asc',
        page: 2,
        per_page: 10,
      })
      .subscribe((p) => (page = p));

    const req = http.expectOne((r) => r.url === `${base}/srm/scorecards`);
    expect(req.request.params.get('search')).toBe('alfa');
    expect(req.request.params.get('tier')).toBe('A');
    expect(req.request.params.get('sort')).toBe('on_time_delivery_rate');
    expect(req.request.params.get('direction')).toBe('asc');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('per_page')).toBe('10');
    req.flush({ data: [{ supplier_id: 's-1' }], meta: { current_page: 2, total: 11 } });

    expect(page?.data).toHaveLength(1);
    expect(page?.meta.total).toBe(11);
  });

  it('defaults a missing ranking page to an empty list', () => {
    let page: SupplierRatingPage | undefined;
    api.scorecards().subscribe((p) => (page = p));

    http
      .expectOne((r) => r.url === `${base}/srm/scorecards`)
      .flush({ data: null, meta: { total: 0 } });

    expect(page?.data).toEqual([]);
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
