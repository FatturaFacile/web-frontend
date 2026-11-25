import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PassengerTransportApiService } from '@core';
import { TachographStore } from './tachograph.store';

const list = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });
const driver = (id: string, name: string, expiries: Record<string, string | null> = {}) => ({
  id,
  driver_employee_id: `e-${id}`,
  driver_name: name,
  driving_license_expiry_date: '2999-01-01',
  cqc_persone_expiry_date: '2999-01-01',
  czv_expiry_date: '2999-01-01',
  tachograph_card_expiry_date: '2999-01-01',
  ...expiries,
});

describe('TachographStore', () => {
  const api = {
    listDrivers: vi.fn(),
    listVehicles: vi.fn(),
    listDddArchives: vi.fn(),
    listInfringements: vi.fn(),
    uploadDdd: vi.fn(),
  };
  let store: InstanceType<typeof TachographStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listDrivers.mockReturnValue(
      list([
        driver('1', 'Rossi', { czv_expiry_date: '2000-01-01', cqc_persone_expiry_date: null }),
        driver('2', 'Bianchi'),
      ]),
    );
    api.listVehicles.mockReturnValue(list([]));
    api.listDddArchives.mockReturnValue(list([{ id: 'a1' }]));
    api.listInfringements.mockReturnValue(list([{ id: 'x1' }, { id: 'x2' }]));
    TestBed.configureTestingModule({
      providers: [TachographStore, { provide: PassengerTransportApiService, useValue: api }],
    });
    store = TestBed.inject(TachographStore);
  });

  it('counts the documents that are expired or expiring and names the drivers', async () => {
    await store.load();

    expect(store.expiringDocuments()).toBeGreaterThanOrEqual(1);
    expect(store.driverName()('e-1')).toBe('Rossi');
    expect(store.driverName()(null)).toBe('');
    expect(store.infringementCount()).toBe(2);
  });

  it('limits the archive and the infringements to the chosen driver', async () => {
    await store.load();
    await store.setDriverFilter('e-2');

    expect(api.listDddArchives).toHaveBeenLastCalledWith('e-2');
    expect(api.listInfringements).toHaveBeenLastCalledWith('e-2');
  });

  it('uploads a .DDD file and reloads the archive', async () => {
    await store.load();
    api.uploadDdd.mockReturnValue(of({ success: true, message: '', data: {} }));
    const file = new File([new Uint8Array([1, 2, 3])], 'card.ddd');

    const outcome = await store.upload(file, 'e-1');

    expect(outcome.ok).toBe(true);
    expect(api.uploadDdd).toHaveBeenCalledWith(file, 'e-1', undefined);
    expect(store.uploading()).toBe(false);
    expect(api.listDddArchives).toHaveBeenCalledTimes(2);
  });
});
