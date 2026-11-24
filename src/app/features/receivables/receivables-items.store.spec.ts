import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivablesApiService } from '@core';
import { ReceivablesItemsStore } from './receivables-items.store';
import { item } from './receivables.fixtures';

const meta = { current_page: 1, from: 1, last_page: 2, per_page: 25, to: 3, total: 40 };

describe('ReceivablesItemsStore', () => {
  let api: Record<'listItems' | 'getItem' | 'setDispute' | 'reverseAllocation', ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ReceivablesItemsStore>;
  const rows = [
    item('1'),
    item('2', { customer_id: 'c-2' }),
    item('3', { status: 'paid', open_amount: '0.00' }),
  ];

  beforeEach(() => {
    api = {
      listItems: vi.fn(() => of({ data: rows, meta })),
      getItem: vi.fn((id: string) => of({ data: { ...item(id), allocations: [] } })),
      setDispute: vi.fn((id: string) =>
        of({ data: item(id, { status: 'disputed', dispute_reason: 'wrong price' }) }),
      ),
      reverseAllocation: vi.fn(() => of({ data: {} })),
    };
    TestBed.configureTestingModule({
      providers: [ReceivablesItemsStore, { provide: ReceivablesApiService, useValue: api }],
    });
    store = TestBed.inject(ReceivablesItemsStore);
  });

  it('opens the list on the drill-down filters, open items only, first page', async () => {
    await store.init({ bucket: '31_60', customer_id: 'c-1' });

    expect(api.listItems).toHaveBeenCalledWith({
      open_only: true,
      per_page: 25,
      bucket: '31_60',
      customer_id: 'c-1',
      page: 1,
    });
    expect(store.items()).toHaveLength(3);
    expect(store.total()).toBe(40);
    expect(store.page()).toBe(1);
    expect(store.pageSize()).toBe(25);
  });

  it('goes back to the first page when a filter changes and keeps the others', async () => {
    await store.init({ bucket: '1_30' });
    await store.setPage(2);
    expect(api.listItems).toHaveBeenLastCalledWith(expect.objectContaining({ bucket: '1_30', page: 2 }));

    await store.setFilters({ status: 'overdue' });
    expect(api.listItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ bucket: '1_30', status: 'overdue', page: 1 }),
    );

    await store.resetFilters();
    expect(api.listItems).toHaveBeenLastCalledWith({ open_only: true, per_page: 25, page: 1 });
  });

  it('selects rows, only the ones with money open when all are ticked', async () => {
    await store.init({});

    store.toggle('1', true);
    expect(store.selectionCount()).toBe(1);
    expect(store.selectionIsCoherent()).toBe(true);
    expect(store.selectionOpenAmount()).toBe('300.00');

    store.toggle('2', true);
    expect(store.selectionIsCoherent()).toBe(false);

    store.toggle('2', false);
    store.toggleAll(true);
    expect(store.selectedIds()).toEqual(['1', '2']);

    store.clearSelection();
    expect(store.selectionCount()).toBe(0);
    expect(store.selectionIsCoherent()).toBe(false);
  });

  it('drops from the selection the rows that left the page', async () => {
    await store.init({});
    store.toggle('1', true);
    api.listItems.mockReturnValueOnce(of({ data: [item('9')], meta }));

    await store.setPage(2);

    expect(store.selectedIds()).toEqual([]);
  });

  it('marks a dispute and merges the fresh row', async () => {
    await store.init({});

    const outcome = await store.setDispute('1', { disputed: true, reason: 'wrong price' });

    expect(outcome.ok).toBe(true);
    expect(api.setDispute).toHaveBeenCalledWith('1', { disputed: true, reason: 'wrong price' });
    expect(store.items()[0].status).toBe('disputed');
    expect(store.saving()).toBe(false);
  });

  it('reports the validation errors of a refused dispute', async () => {
    await store.init({});
    api.setDispute.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Invalid', errors: { reason: ['The reason is required.'] } },
          }),
      ),
    );

    const outcome = await store.setDispute('1', { disputed: true });

    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe('The reason is required.');
    expect(outcome.errors).toEqual({ reason: ['The reason is required.'] });
    expect(store.saving()).toBe(false);
  });

  it('loads the allocations of an item and reverses one, reloading the page and the detail', async () => {
    await store.init({});
    await store.openDetail('1');
    expect(store.detail()?.allocations).toEqual([]);

    const outcome = await store.reverseAllocation('a-1');

    expect(outcome.ok).toBe(true);
    expect(api.reverseAllocation).toHaveBeenCalledWith('a-1');
    expect(api.listItems).toHaveBeenCalledTimes(2);
    expect(api.getItem).toHaveBeenCalledTimes(2);

    store.closeDetail();
    expect(store.detail()).toBeNull();
  });

  it('applies the items answered by an allocation and clears the selection', async () => {
    await store.init({});
    store.toggle('1', true);

    store.applyAllocation([item('1', { open_amount: '100.00', status: 'partially_paid' })]);

    expect(store.items()[0].open_amount).toBe('100.00');
    expect(store.selectedIds()).toEqual([]);
  });

  it('reports a failed load', async () => {
    api.listItems.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })),
    );

    await store.init({});

    expect(store.error()).toBe('Forbidden');
    expect(store.loading()).toBe(false);
  });
});
