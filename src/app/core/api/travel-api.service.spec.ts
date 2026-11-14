import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TravelPerDiemRateRequest, TravelTripRequest } from '../models';
import { TravelApiService } from './travel-api.service';

describe('TravelApiService', () => {
  let service: TravelApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TravelApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists trips with the filters as query parameters', () => {
    service.getTrips({ status: 'submitted', search: 'Lugano', page: 2 }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/travel/trips'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('submitted');
    expect(req.request.params.get('search')).toBe('Lugano');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: [], meta: { current_page: 2, from: null, last_page: 2, per_page: 25, to: null, total: 0 } });
  });

  it('creates and updates a trip with the API field names', () => {
    const payload: TravelTripRequest = {
      purpose: 'Customer workshop',
      destination_city: 'Lugano',
      destination_country: 'CH',
      start_date: '2027-06-14',
      end_date: '2027-06-16',
      departure_time: '07:30',
      return_time: '19:00',
      currency: 'CHF',
      rate_jurisdiction: 'CH',
      estimated_budget: '850.00',
      advance_amount: '300.00',
    };

    service.createTrip(payload).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/travel/trips'));
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });

    service.updateTrip('trip-1', payload).subscribe();
    const update = httpMock.expectOne((r) => r.url.endsWith('/travel/trips/trip-1'));
    expect(update.request.method).toBe('PUT');
    update.flush({ data: {} });
  });

  it('drives the approval flow with one POST per action', () => {
    const calls: [string, () => unknown, object][] = [
      ['submit', () => service.submitTrip('t1'), {}],
      ['withdraw', () => service.withdrawTrip('t1'), {}],
      ['approve', () => service.approveTrip('t1', { advance_amount: '200.00' }), { advance_amount: '200.00' }],
      ['reject', () => service.rejectTrip('t1', { reason: 'No budget' }), { reason: 'No budget' }],
      ['reopen', () => service.reopenTrip('t1'), {}],
      ['complete', () => service.completeTrip('t1'), {}],
      ['advance-paid', () => service.markAdvancePaid('t1', { paid_at: '2027-06-12' }), { paid_at: '2027-06-12' }],
      ['reconcile', () => service.reconcileTrip('t1'), {}],
    ];

    for (const [action, call, body] of calls) {
      (call() as { subscribe: () => void }).subscribe();
      const req = httpMock.expectOne((r) => r.url.endsWith(`/travel/trips/t1/${action}`));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ data: {} });
    }
  });

  it('calculates the per diem with the meals provided per day', () => {
    service.calculatePerDiem('t1', { days: [{ day: '2027-06-14', lunch_provided: true }] }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/travel/trips/t1/per-diem'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ days: [{ day: '2027-06-14', lunch_provided: true }] });
    req.flush({ data: [], totals: { amount: '0.00', tax_free_amount: '0.00', taxable_amount: '0.00', currency: 'EUR' } });
  });

  it('manages itinerary legs, mileage claims and linked expenses under the trip', () => {
    service.addLeg('t1', { leg_type: 'hotel', to_location: 'Hotel Centro', departs_at: '2027-06-14T15:00', arrives_at: '2027-06-16T11:00' }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/travel/trips/t1/legs')).flush({ data: {} });

    service.deleteLeg('t1', 'l1').subscribe();
    httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/travel/trips/t1/legs/l1')).flush(null);

    service.addMileageClaim('t1', { travel_date: '2027-06-14', from_location: 'A', to_location: 'B', vehicle_type: 'car', distance_km: '84.50', round_trip: true }).subscribe();
    const claim = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/travel/trips/t1/mileage-claims'));
    expect(claim.request.body.distance_km).toBe('84.50');
    claim.flush({ data: {} });

    service.linkExpense('t1', { expense_id: 'e1' }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/travel/trips/t1/expenses')).flush({ data: {} });

    service.unlinkExpense('t1', 'e1').subscribe();
    httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/travel/trips/t1/expenses/e1')).flush(null);
  });

  it('reads the reconciliation and the report of a trip', () => {
    service.getReconciliation('t1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/travel/trips/t1/reconciliation')).flush({ data: {} });

    service.getReport('t1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/travel/trips/t1/report')).flush({ data: {} });
  });

  it('maintains the rate tables and adds the reference rates', () => {
    const rate: TravelPerDiemRateRequest = {
      jurisdiction: 'IT',
      year: 2027,
      scope: 'abroad',
      country: 'DE',
      currency: 'EUR',
      daily_amount: '90.00',
      tax_free_daily_amount: '77.47',
    };

    service.createPerDiemRate(rate).subscribe();
    const create = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/travel/rates/per-diem'));
    expect(create.request.body).toEqual(rate);
    create.flush({ data: {} });

    service.getMileageRates({ jurisdiction: 'CH', vehicle_type: 'car' }).subscribe();
    const list = httpMock.expectOne((r) => r.url.endsWith('/travel/rates/mileage'));
    expect(list.request.params.get('jurisdiction')).toBe('CH');
    expect(list.request.params.get('vehicle_type')).toBe('car');
    list.flush({ data: [] });

    service.seedDefaultRates({ jurisdiction: 'CH', year: 2027 }).subscribe();
    const seed = httpMock.expectOne((r) => r.url.endsWith('/travel/rates/defaults'));
    expect(seed.request.body).toEqual({ jurisdiction: 'CH', year: 2027 });
    seed.flush({ data: { per_diem_created: 2, mileage_created: 2 } });
  });
});
