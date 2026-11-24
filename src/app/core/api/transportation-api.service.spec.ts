import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TransportationApiService } from './transportation-api.service';

describe('TransportationApiService', () => {
  let service: TransportationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TransportationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests the dashboard for the given number of days', () => {
    service.getDashboard(30).subscribe();
    const request = httpMock.expectOne((req) => req.url.endsWith('/transportation/dashboard'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('days')).toBe('30');
    request.flush({ data: {} });
  });

  it('reads the bands of one tariff table and the tracking events of one shipment', () => {
    service.getTariffBands('tab-1').subscribe();
    const bands = httpMock.expectOne((req) => req.url.endsWith('/transportation/tariff-bands'));
    expect(bands.request.params.get('tariff_table_id')).toBe('tab-1');
    bands.flush({ data: [] });

    service.getTrackingEvents('ord-1').subscribe();
    const events = httpMock.expectOne((req) => req.url.endsWith('/transportation/tracking-events'));
    expect(events.request.params.get('transport_order_id')).toBe('ord-1');
    events.flush({ data: [] });
  });

  it('sends the stop sequence and the stop completion to the trip endpoints', () => {
    service.reorderTripStops('trip-1', ['s-2', 's-1']).subscribe();
    const reorder = httpMock.expectOne((req) => req.url.endsWith('/transportation/trips/trip-1/stops/sequence'));
    expect(reorder.request.method).toBe('PUT');
    expect(reorder.request.body).toEqual({ stop_ids: ['s-2', 's-1'] });
    reorder.flush({ data: {} });

    service.completeTripStop('trip-1', 's-1', { arrived_at: '2026-11-02T09:00' }).subscribe();
    const complete = httpMock.expectOne((req) => req.url.endsWith('/transportation/trips/trip-1/stops/s-1/complete'));
    expect(complete.request.method).toBe('POST');
    expect(complete.request.body).toEqual({ arrived_at: '2026-11-02T09:00' });
    complete.flush({ data: {} });
  });
});
