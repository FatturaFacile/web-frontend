import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEntry, AuditLedgerApiService } from '@core';
import { AuditLedgerStore } from './audit-ledger.store';

const entry = (sequence: number): AuditEntry => ({
  id: `e${sequence}`,
  sequence,
  occurred_at: '2026-11-01T10:00:00.000000Z',
  tenant_id: 't1',
  company_id: 't1',
  category: 'crud',
  module: 'CRM',
  action: 'UPDATED',
  resource_type: 'App\\Models\\Contact',
  resource_id: 'c1',
  actor_type: 'user',
  actor_ref: '~pk:abc',
  display_actor: 'Mario Rossi',
  impersonator_ref: null,
  display_impersonator: null,
  changes: { name: { old: 'A', new: 'B' } },
  context: null,
  previous_hash: 'p',
  hash: 'h',
  key_version: 1,
  hash_version: 2,
});

const page = (sequences: number[], next: string | null) =>
  of({ success: true, message: '', data: sequences.map(entry), meta: { next_cursor: next, limit: 50 } });

describe('AuditLedgerStore', () => {
  const api = { search: vi.fn() };
  let store: InstanceType<typeof AuditLedgerStore>;

  beforeEach(() => {
    api.search.mockReset();
    TestBed.configureTestingModule({
      providers: [AuditLedgerStore, { provide: AuditLedgerApiService, useValue: api }],
    });
    store = TestBed.inject(AuditLedgerStore);
  });

  it('loads the first page with the filters and keeps the cursor of the next one', async () => {
    api.search.mockReturnValue(page([3, 2], 'cursor-2'));

    await store.load({ category: 'crud', from: '2026-11-01' });

    expect(api.search).toHaveBeenCalledWith({ category: 'crud', from: '2026-11-01' }, null, 50);
    expect(store.entries().map((e) => e.sequence)).toEqual([3, 2]);
    expect(store.nextCursor()).toBe('cursor-2');
    expect(store.loading()).toBe(false);
    expect(store.failure()).toBeNull();
  });

  it('appends the next page with the same filters and stops at the end of the list', async () => {
    api.search.mockReturnValueOnce(page([3, 2], 'cursor-2')).mockReturnValueOnce(page([1], null));

    await store.load({ action: 'UPDATED' });
    await store.loadMore();

    expect(api.search).toHaveBeenLastCalledWith({ action: 'UPDATED' }, 'cursor-2', 50);
    expect(store.entries().map((e) => e.sequence)).toEqual([3, 2, 1]);
    expect(store.nextCursor()).toBeNull();

    await store.loadMore();
    expect(api.search).toHaveBeenCalledTimes(2);
  });

  it('starts over when the filters change', async () => {
    api.search.mockReturnValueOnce(page([3, 2], 'cursor-2')).mockReturnValueOnce(page([9], null));

    await store.load({});
    await store.load({ category: 'security' });

    expect(store.entries().map((e) => e.sequence)).toEqual([9]);
    expect(store.filters()).toEqual({ category: 'security' });
  });

  it('shows an error and no data when the API fails: never mock entries', async () => {
    api.search.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    await store.load({});

    expect(store.failure()).toBe('generic');
    expect(store.entries()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('reports a refusal of the role as forbidden', async () => {
    api.search.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    await store.load({});

    expect(store.failure()).toBe('forbidden');
  });

  it('keeps the loaded entries when a later page fails', async () => {
    api.search
      .mockReturnValueOnce(page([3, 2], 'cursor-2'))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));

    await store.load({});
    await store.loadMore();

    expect(store.entries()).toHaveLength(2);
    expect(store.nextCursor()).toBe('cursor-2');
    expect(store.loadingMore()).toBe(false);
    expect(store.failure()).toBeNull();
  });

  it('selects an entry for the drawer and clears it', () => {
    store.select(entry(5));
    expect(store.selected()?.sequence).toBe(5);

    store.select(null);
    expect(store.selected()).toBeNull();
  });
});
