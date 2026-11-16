import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarrantyRmaApiService } from '@core';
import { httpError, passportFixture } from '../testing/rma-fixtures';
import { RmaNotifier } from './action-result';
import { PassportStore } from './passport.store';

describe('PassportStore', () => {
  let store: InstanceType<typeof PassportStore>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      listPassports: vi.fn().mockReturnValue(of({ data: [passportFixture()], meta: null })),
      getPassport: vi.fn().mockReturnValue(of({ data: passportFixture() })),
      getGenealogy: vi
        .fn()
        .mockReturnValue(of({ data: { as_built: [], as_maintained: [], history: [] } })),
      addExtension: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        PassportStore,
        { provide: WarrantyRmaApiService, useValue: api },
        { provide: RmaNotifier, useValue: { success: vi.fn(), conflict: vi.fn() } },
      ],
    });
    store = TestBed.inject(PassportStore);
  });

  it('filters by serial, customer, jurisdiction and warranty, resetting the page', () => {
    store.setPage(3);
    store.setFilters({ jurisdiction: 'IT', warranty: 'out' });
    expect(api['listPassports']).toHaveBeenLastCalledWith({
      serial_number: null,
      customer_id: null,
      jurisdiction: 'IT',
      warranty: 'out',
      page: 1,
    });
  });

  it('loads passport and genealogy together', () => {
    store.loadPassport('pp-1');
    expect(store.passport()?.id).toBe('pp-1');
    expect(store.genealogy()).toEqual({ as_built: [], as_maintained: [], history: [] });
  });

  it('flags a missing passport', () => {
    api['getPassport'].mockReturnValue(httpError(404));
    store.loadPassport('nope');
    expect(store.detailError()).toBe(true);
  });

  it('updates the passport with the recomputed expiry after adding a care pack', async () => {
    api['addExtension'].mockReturnValue(
      of({
        data: passportFixture({
          warranty_expiry_date: '2028-03-10',
          warranty_policy_type: 'extended_care_pack',
        }),
      }),
    );
    const res = await store.addExtension('pp-1', {
      name: 'Care Pack 12M',
      months: 12,
      starts_at: '2027-03-10',
    });
    expect(res.ok).toBe(true);
    expect(store.passport()?.warranty_expiry_date).toBe('2028-03-10');
  });

  it('returns 422 on an invalid extension', async () => {
    api['addExtension'].mockReturnValue(
      httpError(422, { errors: { starts_at: ['before delivery'] } }),
    );
    const res = await store.addExtension('pp-1', {
      name: 'X',
      months: 12,
      starts_at: '2020-01-01',
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });
});
