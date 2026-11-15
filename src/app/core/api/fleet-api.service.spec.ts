import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FleetFuelEntryRequest, FleetVehicle, fleetEnergyUnitsFor } from '../models';
import { FleetApiService } from './fleet-api.service';

describe('FleetApiService', () => {
  let service: FleetApiService;
  let httpMock: HttpTestingController;

  const vehicle: FleetVehicle = {
    id: 'veh-1',
    license_plate: 'AB123CD',
    vin: null,
    make: 'Fiat',
    model: 'Ducato',
    model_year: 2024,
    vehicle_type: 'van',
    fuel_type: 'diesel',
    status: 'active',
    initial_odometer_km: 10000,
    odometer_km: 12000,
    ownership: 'owned',
    acquired_on: null,
    contract_ends_on: null,
    purchase_value: '20000.00',
    currency: 'EUR',
    asset_id: null,
    notes: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FleetApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(FleetApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the vehicles with the filters as query parameters and skips the empty ones', () => {
    service.getVehicles({ status: 'active', search: 'ab1', fuel_type: undefined, per_page: 100 }).subscribe((response) => {
      expect(response.data).toEqual([vehicle]);
    });

    const request = httpMock.expectOne(
      (r) => r.url.endsWith('/fleet/vehicles') && r.params.get('status') === 'active' && r.params.get('search') === 'ab1' && r.params.get('per_page') === '100' && !r.params.has('fuel_type'),
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: [vehicle] });
  });

  it('creates and updates a vehicle with the API field names', () => {
    service.createVehicle({ license_plate: 'AB123CD', make: 'Fiat', model: 'Ducato', odometer_km: 10000 }).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/fleet/vehicles'));
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ license_plate: 'AB123CD', make: 'Fiat', model: 'Ducato', odometer_km: 10000 });
    create.flush({ data: vehicle });

    service.updateVehicle('veh-1', { odometer_km: 12000 }).subscribe();
    const update = httpMock.expectOne((r) => r.url.endsWith('/fleet/vehicles/veh-1'));
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ odometer_km: 12000 });
    update.flush({ data: vehicle });
  });

  it('reads the costs of a vehicle and the dashboard with its expiry window', () => {
    service.getVehicleCosts('veh-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/fleet/vehicles/veh-1/costs')).flush({ data: {} });

    service.getDashboard(60).subscribe();
    const dashboard = httpMock.expectOne((r) => r.url.endsWith('/fleet/dashboard') && r.params.get('days') === '60');
    dashboard.flush({ data: {} });
  });

  it('ends an assignment and lists the open ones with booleans as 0/1', () => {
    service.endAssignment('as-1', { ends_on: '2027-04-01', end_odometer_km: 14000 }).subscribe();
    const end = httpMock.expectOne((r) => r.url.endsWith('/fleet/assignments/as-1/end'));
    expect(end.request.method).toBe('POST');
    expect(end.request.body).toEqual({ ends_on: '2027-04-01', end_odometer_km: 14000 });
    end.flush({ data: {} });

    service.getAssignments({ vehicle_id: 'veh-1', open: true }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/fleet/assignments') && r.params.get('open') === '1' && r.params.get('vehicle_id') === 'veh-1').flush({ data: [] });
  });

  it('sends a fuel entry with the unit price or the total cost', () => {
    const payload: FleetFuelEntryRequest = { vehicle_id: 'veh-1', entry_date: '2027-01-10', energy_unit: 'liter', quantity: '40', unit_price: '1.8', odometer_km: 10100 };
    service.createFuelEntry(payload).subscribe();
    const request = httpMock.expectOne((r) => r.url.endsWith('/fleet/fuel-entries'));
    expect(request.request.body).toEqual(payload);
    request.flush({ data: {} });

    service.deleteFuelEntry('fu-1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/fleet/fuel-entries/fu-1')).request.method).toBe('DELETE');
  });

  it('filters the scheduled services by overdue and the deadlines by the expiry window', () => {
    service.getScheduledServices({ overdue: true }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/fleet/scheduled-services') && r.params.get('overdue') === '1').flush({ data: [] });

    service.getDeadlines({ expiring: 30, status: 'open' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/fleet/deadlines') && r.params.get('expiring') === '30' && r.params.get('status') === 'open').flush({ data: [] });

    service.renewDeadline('dl-1', { expires_on: '2028-06-30', cost: '700' }).subscribe();
    const renew = httpMock.expectOne((r) => r.url.endsWith('/fleet/deadlines/dl-1/renew'));
    expect(renew.request.body).toEqual({ expires_on: '2028-06-30', cost: '700' });
    renew.flush({ data: {} });
  });

  it('pays an incident today or on a given date', () => {
    service.payIncident('in-1').subscribe();
    const today = httpMock.expectOne((r) => r.url.endsWith('/fleet/incidents/in-1/pay'));
    expect(today.request.body).toEqual({});
    today.flush({ data: {} });

    service.payIncident('in-1', '2027-06-01').subscribe();
    const dated = httpMock.expectOne((r) => r.url.endsWith('/fleet/incidents/in-1/pay'));
    expect(dated.request.body).toEqual({ paid_on: '2027-06-01' });
    dated.flush({ data: {} });
  });

  it('offers the energy units that match the fuel type', () => {
    expect(fleetEnergyUnitsFor('electric')).toEqual(['kwh']);
    expect(fleetEnergyUnitsFor('diesel')).toEqual(['liter', 'kg']);
    expect(fleetEnergyUnitsFor('hybrid')).toEqual(['liter', 'kwh', 'kg']);
  });
});
