import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebtCollectionApiService } from '@core';
import { dashboard, notice, proposalGroup, proposalItem, wrap } from './debt-collection.testing';
import { WorkbenchStore } from './workbench.store';

const groupA = proposalGroup({ key: 'c-1|CHF|1', total: '100.00' });
const groupB = proposalGroup({
  key: 'c-2|EUR|2',
  customer_id: 'c-2',
  customer_name: 'Beta Srl',
  currency: 'EUR',
  jurisdiction: 'IT',
  level: 2,
  total: '50.00',
  receivable_item_ids: ['r-3'],
});

describe('WorkbenchStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof WorkbenchStore>;

  beforeEach(() => {
    api = {
      getDashboard: vi.fn(() => of(wrap(dashboard))),
      listProposals: vi.fn(() =>
        of(wrap({ items: [proposalItem('r-1'), proposalItem('r-2')], groups: [groupA, groupB] })),
      ),
      calculate: vi.fn(() =>
        of(
          wrap({
            principal: '1000.00',
            interest: '5.48',
            fee: '10.00',
            total: '1015.48',
            interest_days: 40,
            rate_percent: '5.00',
            basis: 'actual_365',
            segments: [],
          }),
        ),
      ),
      generate: vi.fn(() => of(wrap({ notices: [notice('n-1'), notice('n-2')], batch: null }))),
    };
    TestBed.configureTestingModule({
      providers: [WorkbenchStore, { provide: DebtCollectionApiService, useValue: api }],
    });
    store = TestBed.inject(WorkbenchStore);
  });

  it('loads the dashboard', async () => {
    await store.loadDashboard();

    expect(store.dashboard()?.proposals.total).toBe(9);
    expect(store.loadingDashboard()).toBe(false);
  });

  it('loads the proposals with the filters and keeps the groups', async () => {
    await store.setFilters({ jurisdiction: 'CH', level: 1 });

    const sent = api['listProposals']?.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent['jurisdiction']).toBe('CH');
    expect(sent['level']).toBe(1);
    expect(store.items()).toHaveLength(2);
    expect(store.groups()).toHaveLength(2);
  });

  it('selects groups and totals them per currency', async () => {
    await store.loadProposals();

    store.toggleGroup(groupA.key, true);
    store.toggleGroup(groupB.key, true);

    expect(store.selectedCount()).toBe(2);
    expect(store.selectedItemCount()).toBe(3);
    expect(store.selectedTotals()).toEqual([
      { currency: 'CHF', amount: '100.00' },
      { currency: 'EUR', amount: '50.00' },
    ]);

    store.toggleGroup(groupA.key, false);
    expect(store.selectedCount()).toBe(1);

    store.selectAll(true);
    expect(store.selectedCount()).toBe(2);
    store.clearSelection();
    expect(store.selectedCount()).toBe(0);
  });

  it('drops from the selection a group that is no longer proposed after a reload', async () => {
    await store.loadProposals();
    store.selectAll(true);
    api['listProposals']?.mockReturnValue(of(wrap({ items: [], groups: [groupA] })));

    await store.loadProposals();

    expect(store.selected()).toEqual([groupA.key]);
  });

  it('opens the calculation of an item with its proposed level', async () => {
    const item = proposalItem('r-1', { proposed_level: 2 });

    await store.openCalculation(item);

    const sent = api['calculate']?.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent['receivable_item_id']).toBe('r-1');
    expect(sent['level']).toBe(2);
    expect(store.calculation()?.total).toBe('1015.48');

    store.closeCalculation();
    expect(store.calculationItem()).toBeNull();
    expect(store.calculation()).toBeNull();
  });

  it('generates the notices of the selected groups, clears the selection and re-reads the queue', async () => {
    await store.loadProposals();
    store.toggleGroup(groupA.key, true);

    const { outcome, result } = await store.generate({
      channel: 'email',
      post_charges: true,
      dispatch: false,
    });

    expect(outcome.ok).toBe(true);
    expect(result?.notices).toHaveLength(2);
    const payload = api['generate']?.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['groups']).toEqual([
      { customer_id: 'c-1', currency: 'CHF', level: 1, receivable_item_ids: ['r-1', 'r-2'] },
    ]);
    expect(payload['channel']).toBe('email');
    expect(payload['post_charges']).toBe(true);
    expect(payload['dispatch']).toBe(false);
    expect(payload).not.toHaveProperty('locale');
    expect(store.selected()).toEqual([]);
    expect(api['listProposals']).toHaveBeenCalledTimes(2);
    expect(api['getDashboard']).toHaveBeenCalledTimes(1);
  });

  it('sends the locale when one is chosen', async () => {
    await store.loadProposals();
    store.toggleGroup(groupA.key, true);

    await store.generate({ channel: 'pec', locale: 'it', post_charges: false, dispatch: true });

    const payload = api['generate']?.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['locale']).toBe('it');
    expect(payload['dispatch']).toBe(true);
  });

  it('answers the translated refusal of the API when the generation fails', async () => {
    await store.loadProposals();
    store.toggleGroup(groupA.key, true);
    api['generate']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'no_channel_address' } }),
      ),
    );

    const { outcome, result } = await store.generate({
      channel: 'pec',
      post_charges: true,
      dispatch: true,
    });

    expect(result).toBeNull();
    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('debtCollection.error.no_channel_address');
    expect(store.generating()).toBe(false);
    expect(store.selected()).toEqual([groupA.key]);
  });

  it('keeps the error key when the queue cannot be read', async () => {
    api['listProposals']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    await store.loadProposals();

    expect(store.error()).toBe('debtCollection.error.generic');
    expect(store.loadingProposals()).toBe(false);
  });
});
