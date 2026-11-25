import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IcReconciliationBatch, IcReconciliationItem, IntercompanyApiService } from '@core';
import { IntercompanyReconciliationStore } from './intercompany-reconciliation.store';

const TOTALS = {
  items: 2,
  matched: 1,
  unmatched: 1,
  disputed: 0,
  written_off: 0,
  adjusted: 0,
  difference_by_anomaly: { timing: '0.0000', fx: '2.0000', amount: '0.0000', tax: '0.0000', missing_counterpart: '0.0000' },
};

function item(overrides: Partial<IcReconciliationItem> = {}): IcReconciliationItem {
  return {
    id: 'i1',
    batch_id: 'b1',
    entity_a_tenant_id: 'a',
    entity_a_name: 'Alpha AG',
    entity_b_tenant_id: 'b',
    entity_b_name: 'Beta Srl',
    a_document_id: 'd1',
    a_document_number: 'INV-1',
    a_document_date: '2026-11-01',
    a_currency: 'CHF',
    a_amount: '100.0000',
    a_tax: '8.1000',
    b_document_id: null,
    b_document_number: null,
    b_document_date: null,
    b_currency: null,
    b_amount: null,
    b_tax: null,
    difference: '100.0000',
    difference_group_currency: '100.0000',
    status: 'unmatched',
    anomaly_type: 'missing_counterpart',
    anomaly_reason: null,
    match_kind: null,
    resolution_reason: null,
    resolved_by: null,
    resolved_at: null,
    ...overrides,
  };
}

function batch(items: IcReconciliationItem[] = [item()]): IcReconciliationBatch {
  return { id: 'b1', group_id: 'g1', as_of_date: '2026-12-31', status: 'open', totals: TOTALS, created_at: '2026-12-31T00:00:00Z', items };
}

const MATRIX = {
  currency: 'CHF',
  as_of_date: '2026-12-31',
  entities: [
    { tenant_id: 'a', name: 'Alpha AG' },
    { tenant_id: 'b', name: 'Beta Srl' },
  ],
  cells: [
    {
      entity_a_tenant_id: 'a',
      entity_b_tenant_id: 'b',
      receivable_a: '100.0000',
      payable_b: '0.0000',
      difference: '100.0000',
      anomaly_counts: { timing: 0, fx: 0, amount: 0, tax: 0, missing_counterpart: 1 },
      status: 'difference',
      open_items: 1,
    },
  ],
};

describe('IntercompanyReconciliationStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof IntercompanyReconciliationStore>;

  beforeEach(() => {
    api = {
      getBatches: vi.fn(() => of({ success: true, message: '', data: [batch([])] })),
      getBatch: vi.fn(() => of({ success: true, message: '', data: batch() })),
      createBatch: vi.fn(() => of({ success: true, message: '', data: batch([]) })),
      getMatrix: vi.fn(() => of({ success: true, message: '', data: MATRIX })),
      disputeItem: vi.fn(() => of({ success: true, message: '', data: item({ status: 'disputed' }) })),
      matchItem: vi.fn(() => of({ success: true, message: '', data: item({ status: 'matched', match_kind: 'manual' }) })),
      unmatchItem: vi.fn(),
      writeOffItem: vi.fn(),
      adjustItem: vi.fn(() => of({ success: true, message: '', data: item({ status: 'adjusted' }) })),
    };
    TestBed.configureTestingModule({
      providers: [IntercompanyReconciliationStore, { provide: IntercompanyApiService, useValue: api }],
    });
    store = TestBed.inject(IntercompanyReconciliationStore);
  });

  it('opens the latest batch and its matrix', async () => {
    await store.load('g1');

    expect(api['getBatch']).toHaveBeenCalledWith('b1', {});
    expect(api['getMatrix']).toHaveBeenCalledWith('g1', '2026-12-31');
    expect(store.items()).toHaveLength(1);
    expect(store.matrix()?.cells).toHaveLength(1);
  });

  it('finds the cell of a pair of entities', async () => {
    await store.load('g1');

    expect(store.cellOf()('a', 'b')?.status).toBe('difference');
    expect(store.cellOf()('b', 'a')).toBeNull();
  });

  it('shows an empty cockpit when there is no batch yet', async () => {
    api['getBatches'].mockReturnValue(of({ success: true, message: '', data: [] }));

    await store.load('g1');

    expect(store.batch()).toBeNull();
    expect(store.matrix()).toBeNull();
  });

  it('runs a batch with automatic matching and clears the filters', async () => {
    await store.applyFilters({ anomaly_type: 'fx' });

    await store.runBatch('g1', '2026-12-31', true);

    expect(api['createBatch']).toHaveBeenCalledWith('g1', '2026-12-31', true);
    expect(store.filters()).toEqual({});
    expect(store.batches()[0].id).toBe('b1');
  });

  it('drills down to a pair of entities by filtering the items', async () => {
    await store.load('g1');

    await store.drillDown({ entity_a_tenant_id: 'a', entity_b_tenant_id: 'b' });

    expect(api['getBatch']).toHaveBeenLastCalledWith('b1', { entity_a_tenant_id: 'a', entity_b_tenant_id: 'b' });
    expect(store.cell()).toEqual({ entity_a_tenant_id: 'a', entity_b_tenant_id: 'b' });
  });

  it('applies a manual resolution to the item and refreshes the batch and matrix', async () => {
    await store.load('g1');
    const current = store.items()[0];

    const outcome = await store.dispute(current, 'wrong price');

    expect(outcome.ok).toBe(true);
    expect(api['disputeItem']).toHaveBeenCalledWith('i1', 'wrong price');
    expect(store.items()[0].status).toBe('disputed');
    expect(store.busy()).toEqual([]);
  });

  it('sends the counterpart document of a manual match and the amount of an adjustment', async () => {
    await store.load('g1');
    const current = store.items()[0];

    await store.match(current, 'd9');
    await store.adjust(current, 'rounding', '1.5000');

    expect(api['matchItem']).toHaveBeenCalledWith('i1', 'd9');
    expect(api['adjustItem']).toHaveBeenCalledWith('i1', 'rounding', '1.5000');
  });
});
