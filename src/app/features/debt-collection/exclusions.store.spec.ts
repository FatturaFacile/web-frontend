import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebtCollectionApiService } from '@core';
import { proposalItem, wrap } from './debt-collection.testing';
import { ExclusionsStore } from './exclusions.store';

const exclusion = {
  id: 'x-1',
  customer_id: 'c-1',
  customer_name: 'ACME SA',
  receivable_item_id: null,
  type: 'dispute' as const,
  reason: 'Goods damaged',
  notes: null,
  created_at: '2026-05-01T09:00:00Z',
  released_at: null,
};

describe('ExclusionsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ExclusionsStore>;

  beforeEach(() => {
    api = {
      listExclusions: vi.fn(() => of(wrap([exclusion]))),
      listPaymentPlans: vi.fn(() => of(wrap([]))),
      listProposals: vi.fn(() => of(wrap({ items: [proposalItem('r-1')], groups: [] }))),
      createExclusion: vi.fn(() => of(wrap(exclusion))),
      releaseExclusion: vi.fn(() => of(wrap({ ...exclusion, released_at: '2026-05-02' }))),
      createPaymentPlan: vi.fn(() => of(wrap({}))),
      transitionPaymentPlan: vi.fn(() => of(wrap({}))),
    };
    TestBed.configureTestingModule({
      providers: [ExclusionsStore, { provide: DebtCollectionApiService, useValue: api }],
    });
    store = TestBed.inject(ExclusionsStore);
  });

  it('loads the active exclusions and the payment plans of a customer', async () => {
    await store.setCustomer('c-1');

    expect(api['listExclusions']).toHaveBeenCalledWith({ customer_id: 'c-1', active: 1 });
    expect(api['listPaymentPlans']).toHaveBeenCalledWith('c-1');
    expect(store.exclusions()).toHaveLength(1);
  });

  it('asks for all the exclusions when the active filter is off', async () => {
    await store.setActiveOnly(false);

    expect(api['listExclusions']).toHaveBeenCalledWith({});
  });

  it('creates an exclusion and reloads the list', async () => {
    const outcome = await store.createExclusion({
      customer_id: 'c-1',
      type: 'dispute',
      reason: 'Goods damaged',
    });

    expect(outcome.ok).toBe(true);
    expect(api['createExclusion']).toHaveBeenCalledOnce();
    expect(api['listExclusions']).toHaveBeenCalledOnce();
    expect(store.saving()).toBe(false);
  });

  it('releases an exclusion with a note', async () => {
    await store.releaseExclusion('x-1', 'Agreed with the customer');

    expect(api['releaseExclusion']).toHaveBeenCalledWith('x-1', 'Agreed with the customer');
  });

  it('transitions a payment plan', async () => {
    await store.transitionPlan('pp-1', 'default');

    expect(api['transitionPaymentPlan']).toHaveBeenCalledWith('pp-1', 'default');
  });

  it('loads the open items a plan can cover, none without a customer', async () => {
    await store.loadItems('c-1');
    expect(store.items()).toHaveLength(1);
    expect(
      (api['listProposals']?.mock.calls[0]?.[0] as Record<string, unknown>)['include_excluded'],
    ).toBe(1);

    await store.loadItems(null);
    expect(store.items()).toEqual([]);
  });

  it('answers the error key of a refused write', async () => {
    api['createPaymentPlan']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'plan_invalid_schedule' } }),
      ),
    );

    const outcome = await store.createPlan({
      customer_id: 'c-1',
      currency: 'CHF',
      total_amount: '10.00',
      start_date: '2026-06-01',
      end_date: '2026-06-01',
      receivable_item_ids: ['r-1'],
      installments: [{ due_date: '2026-06-01', amount: '10.00' }],
    });

    expect(outcome.errorKey).toBe('debtCollection.error.plan_invalid_schedule');
    expect(store.saving()).toBe(false);
  });
});
