import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService } from '@core';
import { StoresStore } from './stores.store';

const page = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });
const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('StoresStore', () => {
  const api = {
    listStores: vi.fn(),
    createStore: vi.fn(),
    updateStore: vi.fn(),
    deleteStore: vi.fn(),
    issueLinkCode: vi.fn(),
  };
  let store: InstanceType<typeof StoresStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listStores.mockReturnValue(page([{ id: 's1', code: 'MI-001' }]));
    TestBed.configureTestingModule({
      providers: [StoresStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(StoresStore);
  });

  it('loads the stores with an optional search', async () => {
    await store.load('MI');

    expect(api.listStores).toHaveBeenCalledWith('MI');
    expect(store.stores()).toHaveLength(1);
  });

  it('creates without an id and updates with one, then reloads', async () => {
    api.createStore.mockReturnValue(ok());
    api.updateStore.mockReturnValue(ok());
    const payload = { code: 'RM-001', name: 'Roma Prati', store_type: 'franchisee' as const, country: 'IT' };

    expect((await store.save(payload)).ok).toBe(true);
    expect(api.createStore).toHaveBeenCalledWith(payload);
    expect((await store.save(payload, 's1')).ok).toBe(true);
    expect(api.updateStore).toHaveBeenCalledWith('s1', payload);
    expect(api.listStores).toHaveBeenCalledTimes(2);
  });

  it('reports the refusal of a delete with its translation key', async () => {
    api.deleteStore.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'store_has_active_agreement' } })),
    );

    const outcome = await store.remove('s1');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('franchiseNetwork.error.store_has_active_agreement');
    expect(store.saving()).toBe(false);
  });

  it('returns the one-time link code of a franchisee store', async () => {
    api.issueLinkCode.mockReturnValue(ok({ code: 'ABC123' }));

    const result = await store.issueLinkCode('s1');

    expect(result.code).toBe('ABC123');
    expect(result.outcome.ok).toBe(true);
  });
});
