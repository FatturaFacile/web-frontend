import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PassengerTransportApiService } from '@core';
import { FleetStore } from './fleet.store';

const list = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });

describe('FleetStore', () => {
  const api = {
    listVehicles: vi.fn(),
    createVehicle: vi.fn(),
    updateVehicle: vi.fn(),
    deleteVehicle: vi.fn(),
  };
  let store: InstanceType<typeof FleetStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listVehicles.mockReturnValue(list([{ id: 'v1', license_plate: 'AA111AA' }]));
    TestBed.configureTestingModule({
      providers: [FleetStore, { provide: PassengerTransportApiService, useValue: api }],
    });
    store = TestBed.inject(FleetStore);
  });

  it('loads the vehicles with an optional search', async () => {
    await store.load('AA');

    expect(api.listVehicles).toHaveBeenCalledWith('AA');
    expect(store.vehicles()).toHaveLength(1);
  });

  it('creates without an id and updates with one, then reloads', async () => {
    api.createVehicle.mockReturnValue(of({ success: true, message: '', data: {} }));
    api.updateVehicle.mockReturnValue(of({ success: true, message: '', data: {} }));
    const payload = {
      license_plate: 'BB222BB',
      vehicle_category: 'sedan_ncc' as const,
      passenger_capacity: 4,
    };

    expect((await store.save(payload)).ok).toBe(true);
    expect(api.createVehicle).toHaveBeenCalledWith(payload);
    expect((await store.save(payload, 'v1')).ok).toBe(true);
    expect(api.updateVehicle).toHaveBeenCalledWith('v1', payload);
    expect(api.listVehicles).toHaveBeenCalledTimes(2);
  });
});
