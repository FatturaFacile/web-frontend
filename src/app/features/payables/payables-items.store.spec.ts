import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayablesApiService } from '@core';
import { PayablesItemsStore } from './payables-items.store';
import { apItem, skonto } from './payables.fixtures';

const meta = { current_page: 1, from: 1, last_page: 2, per_page: 25, to: 3, total: 40 };
const summary = {
  total_open: '3000.00',
  total_overdue: '1000.00',
  skonto_savings: '20.00',
  blocked_count: 1,
  currency: 'EUR',
};

describe('PayablesItemsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof PayablesItemsStore>;
  const rows = [
    apItem('1', { skonto: skonto() }),
    apItem('2', { status: 'blocked', block_reason: 'wrong quantity' }),
    apItem('3', { status: 'disputed', block_reason: 'wrong price' }),
  ];

  beforeEach(() => {
    api = {
      listItems: vi.fn(() => of({ data: rows, meta })),
      getItemSummary: vi.fn(() => of({ data: summary })),
      getItem: vi.fn((id: string) => of({ data: { ...apItem(id), block_history: [] } })),
      block: vi.fn((id: string) =>
        of({ data: apItem(id, { status: 'blocked', block_reason: 'x' }) }),
      ),
      release: vi.fn((id: string) => of({ data: apItem(id) })),
    };
    TestBed.configureTestingModule({
      providers: [PayablesItemsStore, { provide: PayablesApiService, useValue: api }],
    });
    store = TestBed.inject(PayablesItemsStore);
  });

  it('opens on the filters of the url, open items only, first page', async () => {
    await store.init({ supplier_id: 's-1', skonto_only: true });

    expect(api['listItems']).toHaveBeenCalledWith({
      open_only: true,
      per_page: 25,
      supplier_id: 's-1',
      skonto_only: true,
      page: 1,
    });
    expect(store.items()).toHaveLength(3);
    expect(store.total()).toBe(40);
    expect(store.summary()).toEqual(summary);
  });

  it('counts the blocked items and the Skonto opportunities of the page', async () => {
    await store.init({});

    expect(store.blockedCount()).toBe(2);
    expect(store.skontoOpportunities()).toBe(1);
  });

  it('goes back to the first page when a filter changes and keeps the others', async () => {
    await store.init({ status: 'open' });
    await store.setPage(2);
    expect(api['listItems']).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'open', page: 2 }),
    );

    await store.setFilters({ skonto_only: true });
    expect(api['listItems']).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'open', skonto_only: true, page: 1 }),
    );
  });

  it('resets to the open items of the first page', async () => {
    await store.init({ status: 'blocked' });
    await store.resetFilters();

    expect(store.filters()).toEqual({ open_only: true, per_page: 25, page: 1 });
  });

  it('keeps the list when the summary cannot be loaded', async () => {
    api['getItemSummary'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    await store.init({});

    expect(store.items()).toHaveLength(3);
    expect(store.summary()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('reports a load error with the message of the API or a translation key', async () => {
    api['listItems'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'boom' } })),
    );
    await store.init({});
    expect(store.error()).toBe('boom');
    expect(store.loading()).toBe(false);

    api['listItems'].mockReturnValueOnce(throwError(() => new Error('offline')));
    await store.refresh();
    expect(store.error()).toBe('AP.LOAD_ERROR');
  });

  it('ignores a slow answer that arrives after a newer one', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    api['listItems'].mockReturnValueOnce({
      subscribe: (observer: { next: (v: unknown) => void; complete: () => void }) => {
        resolveFirst = (value) => {
          observer.next(value);
          observer.complete();
        };
        return { unsubscribe: () => undefined };
      },
    });
    const slow = store.init({ status: 'open' });
    await store.init({ status: 'paid' });
    resolveFirst({ data: [apItem('old')], meta });
    await slow;

    expect(store.items().map((row) => row.id)).toEqual(['1', '2', '3']);
    expect(store.filters().status).toBe('paid');
  });

  it('blocks an item with its kind and reason and merges the fresh row', async () => {
    await store.init({});
    const outcome = await store.block('1', { kind: 'block', reason: 'under review' });

    expect(api['block']).toHaveBeenCalledWith('1', { kind: 'block', reason: 'under review' });
    expect(outcome.ok).toBe(true);
    expect(store.items().find((row) => row.id === '1')?.status).toBe('blocked');
    expect(store.saving()).toBe(false);
  });

  it('releases an item with the audit reason', async () => {
    await store.init({});
    const outcome = await store.release('2', 'documents received');

    expect(api['release']).toHaveBeenCalledWith('2', { reason: 'documents received' });
    expect(outcome.ok).toBe(true);
    expect(store.items().find((row) => row.id === '2')?.status).toBe('open');
  });

  it('binds the field errors of a rejected block', async () => {
    api['block'].mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'invalid', errors: { reason: ['The reason is required.'] } },
          }),
      ),
    );
    await store.init({});
    const outcome = await store.block('1', { kind: 'dispute', reason: '' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toEqual({ reason: ['The reason is required.'] });
    expect(store.items().find((row) => row.id === '1')?.status).toBe('open');
    expect(store.saving()).toBe(false);
  });

  it('opens and closes the detail with the history', async () => {
    await store.openDetail('1');
    expect(store.detail()?.id).toBe('1');
    store.closeDetail();
    expect(store.detail()).toBeNull();
  });
});
