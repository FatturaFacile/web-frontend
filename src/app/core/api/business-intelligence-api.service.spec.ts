import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { biFreeSlot, biLayoutsOverlap } from '../models';
import { BusinessIntelligenceApiService } from './business-intelligence-api.service';

describe('BusinessIntelligenceApiService', () => {
  let service: BusinessIntelligenceApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BusinessIntelligenceApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BusinessIntelligenceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends the explorer query with the API field names', () => {
    const body = { dataset: 'sales', spec: { dimensions: ['customer'], measures: ['net_amount'] }, calculated_measures: ['average_ticket'], pivot: { rows: ['customer'], columns: [], values: ['net_amount'] } };
    service.explore(body).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/business-intelligence/explorer/run'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({ data: { result: { columns: [], rows: [], meta: {} }, pivot: null } });
  });

  it('writes the drill-down and the filters of a viewer as Laravel nested query keys', () => {
    service
      .getWidgetData('w-1', {
        period: { preset: 'year_to_date' },
        filters: [{ field: 'customer_country', operator: 'eq', value: 'IT' }],
        drill: [{ dimension: 'customer_country', value: 'IT' }, { dimension: 'customer', value: null }],
      })
      .subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/business-intelligence/widgets/w-1/data'));
    expect(request.request.params.get('period[preset]')).toBe('year_to_date');
    expect(request.request.params.get('filters[0][field]')).toBe('customer_country');
    expect(request.request.params.get('filters[0][value]')).toBe('IT');
    expect(request.request.params.get('drill[0][value]')).toBe('IT');
    expect(request.request.params.get('drill[1][dimension]')).toBe('customer');
    expect(request.request.params.has('drill[1][value]')).toBe(false);
    request.flush({ data: {} });
  });

  it('saves the layout, shares and takes snapshots on the documented routes', () => {
    service.saveLayout('d-1', [{ id: 'w-1', x: 0, y: 0, w: 6, h: 4 }]).subscribe();
    const layout = httpMock.expectOne((r) => r.url.endsWith('/dashboards/d-1/layout'));
    expect(layout.request.method).toBe('PUT');
    expect(layout.request.body).toEqual({ layout: [{ id: 'w-1', x: 0, y: 0, w: 6, h: 4 }] });
    layout.flush({ data: {} });

    service.share({ resource_type: 'dashboard', resource_id: 'd-1', user_id: 'u-1', permission: 'edit' }).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/business-intelligence/shares')).request.method).toBe('POST');

    service.takeSnapshot('saved_query', 'q-1').subscribe();
    const snapshot = httpMock.expectOne((r) => r.url.endsWith('/business-intelligence/snapshots'));
    expect(snapshot.request.body).toEqual({ source_type: 'saved_query', source_id: 'q-1' });

    service.getShares('dashboard', 'd-1').subscribe();
    const shares = httpMock.expectOne((r) => r.url.endsWith('/business-intelligence/shares'));
    expect(shares.request.params.get('resource_type')).toBe('dashboard');
    expect(shares.request.params.get('resource_id')).toBe('d-1');
  });

  it('places a new widget on the first free spot of the 12-column grid like the API does', () => {
    expect(biFreeSlot([])).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    expect(biFreeSlot([{ x: 0, y: 0, w: 6, h: 4 }])).toEqual({ x: 6, y: 0, w: 6, h: 4 });
    expect(biFreeSlot([{ x: 0, y: 0, w: 6, h: 4 }, { x: 6, y: 0, w: 6, h: 4 }])).toEqual({ x: 0, y: 4, w: 6, h: 4 });
    expect(biLayoutsOverlap({ x: 0, y: 0, w: 6, h: 4 }, { x: 6, y: 0, w: 6, h: 4 })).toBe(false);
    expect(biLayoutsOverlap({ x: 0, y: 0, w: 6, h: 4 }, { x: 5, y: 3, w: 2, h: 2 })).toBe(true);
  });

  it('reads a single dataset and a single calculated measure', () => {
    service.getDataset('sales').subscribe();
    const dataset = httpMock.expectOne((r) => r.url.endsWith('/business-intelligence/datasets/sales'));
    expect(dataset.request.method).toBe('GET');
    dataset.flush({ data: {} });

    service.getCalculatedMeasure('m1').subscribe();
    const measure = httpMock.expectOne((r) => r.url.endsWith('/business-intelligence/calculated-measures/m1'));
    expect(measure.request.method).toBe('GET');
    measure.flush({ data: {} });
  });
});
