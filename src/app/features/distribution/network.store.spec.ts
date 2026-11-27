import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributionApiService } from '@core';
import { NetworkStore } from './network.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('NetworkStore', () => {
  const api = {
    getLookups: vi.fn(),
    listNetworkWarehouses: vi.fn(),
    listLanes: vi.fn(),
    saveProfile: vi.fn(),
    createLane: vi.fn(),
    updateLane: vi.fn(),
    deleteLane: vi.fn(),
  };
  let store: InstanceType<typeof NetworkStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(ok({ warehouse_roles: ['internal'] }));
    api.listNetworkWarehouses.mockReturnValue(ok([{ id: 'w1', code: 'MI', profile: null }]));
    api.listLanes.mockReturnValue(ok([{ id: 'l1' }]));
    TestBed.configureTestingModule({
      providers: [NetworkStore, { provide: DistributionApiService, useValue: api }],
    });
    store = TestBed.inject(NetworkStore);
  });

  it('loads warehouses, lanes and lookups together', async () => {
    await store.load();

    expect(store.warehouses()).toHaveLength(1);
    expect(store.lanes()).toHaveLength(1);
    expect(store.lookups()?.warehouse_roles).toEqual(['internal']);
    expect(store.loading()).toBe(false);
  });

  it('saves a profile and reloads the topology', async () => {
    api.saveProfile.mockReturnValue(ok());

    const outcome = await store.saveProfile('w1', {
      role: 'third_party_3pl',
      external_reference: 'EXT-1',
    });

    expect(outcome.ok).toBe(true);
    expect(api.saveProfile).toHaveBeenCalledWith('w1', {
      role: 'third_party_3pl',
      external_reference: 'EXT-1',
    });
    expect(api.listLanes).toHaveBeenCalledTimes(1);
  });

  it('creates a lane without an id, updates it with one and deletes it', async () => {
    api.createLane.mockReturnValue(ok());
    api.updateLane.mockReturnValue(ok());
    api.deleteLane.mockReturnValue(ok(null));
    const payload = {
      source_warehouse_id: 'a',
      destination_warehouse_id: 'b',
      lead_time_days: 2,
      transport_mode: 'road' as const,
    };

    expect((await store.saveLane(payload)).ok).toBe(true);
    expect(api.createLane).toHaveBeenCalledWith(payload);
    expect((await store.saveLane(payload, 'l1')).ok).toBe(true);
    expect(api.updateLane).toHaveBeenCalledWith('l1', payload);
    expect((await store.removeLane('l1')).ok).toBe(true);
    expect(api.deleteLane).toHaveBeenCalledWith('l1');
  });

  it('reports the refusal of a lane with its translation key', async () => {
    api.createLane.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'lane_exists', errors: { source_warehouse_id: ['x'] } },
          }),
      ),
    );

    const outcome = await store.saveLane({
      source_warehouse_id: 'a',
      destination_warehouse_id: 'a',
      lead_time_days: 1,
      transport_mode: 'road',
    });

    expect(outcome.errorKey).toBe('distribution.error.lane_exists');
    expect(outcome.errors['source_warehouse_id']).toEqual(['x']);
    expect(store.saving()).toBe(false);
  });
});
