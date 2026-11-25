import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebtCollectionApiService } from '@core';
import { CustomerDunningStore } from './customer-dunning.store';
import { history, lookups, proposalItem, wrap } from './debt-collection.testing';
import { DcLookupsStore, DEFAULT_LOOKUPS } from './lookups.store';

describe('CustomerDunningStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof CustomerDunningStore>;

  beforeEach(() => {
    api = {
      getCustomerHistory: vi.fn(() => of(wrap(history()))),
      listProposals: vi.fn(() => of(wrap({ items: [proposalItem('r-1')], groups: [] }))),
      createExclusion: vi.fn(() => of(wrap({}))),
      releaseExclusion: vi.fn(() => of(wrap({}))),
      transitionPaymentPlan: vi.fn(() => of(wrap({}))),
    };
    TestBed.configureTestingModule({
      providers: [CustomerDunningStore, { provide: DebtCollectionApiService, useValue: api }],
    });
    store = TestBed.inject(CustomerDunningStore);
  });

  it('loads the dunning history of a customer', async () => {
    await store.load('c-1');

    expect(api['getCustomerHistory']).toHaveBeenCalledWith('c-1');
    expect(store.history()?.summary.current_level).toBe(2);
    expect(store.history()?.notices).toHaveLength(1);
    expect(store.loading()).toBe(false);
  });

  it('keeps the error key when the history cannot be read', async () => {
    api['getCustomerHistory']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'forbidden' } })),
    );

    await store.load('c-1');

    expect(store.error()).toBe('debtCollection.error.forbidden');
  });

  it('flags a dispute and reloads the history of the customer', async () => {
    await store.load('c-1');

    const outcome = await store.flag({
      customer_id: 'c-1',
      type: 'dispute',
      reason: 'Goods damaged',
    });

    expect(outcome.ok).toBe(true);
    expect(api['createExclusion']).toHaveBeenCalledOnce();
    expect(api['getCustomerHistory']).toHaveBeenCalledTimes(2);
  });

  it('releases an exclusion and closes a payment plan', async () => {
    await store.load('c-1');

    await store.release('x-1', 'Settled');
    await store.transitionPlan('pp-1', 'complete');

    expect(api['releaseExclusion']).toHaveBeenCalledWith('x-1', 'Settled');
    expect(api['transitionPaymentPlan']).toHaveBeenCalledWith('pp-1', 'complete');
  });

  it('loads the open items a payment plan can cover', async () => {
    await store.load('c-1');
    await store.loadItems();

    expect(store.items()).toHaveLength(1);
  });
});

describe('DcLookupsStore', () => {
  it('reads the lookups once and keeps the contract defaults for what the API omits', async () => {
    const api = { getLookups: vi.fn(() => of(wrap({ ...lookups, currencies: ['CHF'] }))) };
    TestBed.configureTestingModule({
      providers: [{ provide: DebtCollectionApiService, useValue: api }],
    });
    const store = TestBed.inject(DcLookupsStore);

    await store.ensureLoaded();
    await store.ensureLoaded();

    expect(api.getLookups).toHaveBeenCalledOnce();
    expect(store.lookups().currencies).toEqual(['CHF']);
    expect(store.lookups().channels).toEqual(DEFAULT_LOOKUPS.channels);
  });

  it('falls back to the defaults when the call fails', async () => {
    const api = { getLookups: vi.fn(() => throwError(() => new Error('down'))) };
    TestBed.configureTestingModule({
      providers: [{ provide: DebtCollectionApiService, useValue: api }],
    });
    const store = TestBed.inject(DcLookupsStore);

    await store.ensureLoaded();

    expect(store.loaded()).toBe(true);
    expect(store.lookups()).toEqual(DEFAULT_LOOKUPS);
  });
});
