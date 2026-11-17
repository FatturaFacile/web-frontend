import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RmaBoardColumn, WarrantyRmaApiService } from '@core';
import { httpError } from '../testing/rma-fixtures';
import { RmaBoardStore } from './rma-board.store';

const columns: RmaBoardColumn[] = [
  {
    status: 'awaiting_estimate_approval',
    label: 'x',
    count: 1,
    items: [
      {
        id: 'rma-1',
        rma_number: 'RMA-2026-000123',
        serial_number: 'SN123',
        customer_name: 'ACME SA',
        warranty_status: 'out_of_warranty_billable',
        estimate_approval_status: 'pending_customer_approval',
        age_days: 3,
        has_loaner: true,
        loaner_overdue: true,
      },
    ],
  },
  { status: 'awaiting_arrival', label: 'x', count: 0, items: [] },
  { status: 'closed', label: 'x', count: 4, items: [] },
  { status: 'on_hold' as never, label: 'On hold', count: 1, items: [] },
];

describe('RmaBoardStore', () => {
  let store: InstanceType<typeof RmaBoardStore>;
  let api: { getBoard: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      getBoard: vi
        .fn()
        .mockReturnValue(of({ data: { columns }, meta: { generated_at: '2026-11-15T10:00:00Z' } })),
    };
    TestBed.configureTestingModule({
      providers: [RmaBoardStore, { provide: WarrantyRmaApiService, useValue: api }],
    });
    store = TestBed.inject(RmaBoardStore);
  });

  it('loads the board without closed RMAs by default', () => {
    store.load();
    expect(api.getBoard).toHaveBeenCalledWith({
      warranty_status: null,
      customer_id: null,
      include_closed: 0,
    });
    expect(store.generatedAt()).toBe('2026-11-15T10:00:00Z');
  });

  it('shows one column per workflow status in order, with counts, plus unknown statuses', () => {
    store.load();
    const visible = store.visibleColumns();
    expect(visible.map((c) => c.status)).toEqual([
      'awaiting_arrival',
      'in_diagnosis',
      'awaiting_estimate_approval',
      'awaiting_parts',
      'in_repair_testing',
      'ready_for_return',
      'returned',
      'on_hold',
    ]);
    expect(visible.find((c) => c.status === 'awaiting_estimate_approval')?.count).toBe(1);
    expect(visible.find((c) => c.status === 'in_diagnosis')?.count).toBe(0);
  });

  it('adds the closed column and reloads when the toggle is on', () => {
    store.setFilters({ include_closed: true });
    expect(api.getBoard).toHaveBeenLastCalledWith({
      warranty_status: null,
      customer_id: null,
      include_closed: 1,
    });
    expect(store.visibleColumns().some((c) => c.status === 'closed')).toBe(true);
    expect(store.countOf('closed')).toBe(4);
  });

  it('passes the warranty filter', () => {
    store.setFilters({ warranty_status: 'goodwill' });
    expect(api.getBoard).toHaveBeenLastCalledWith({
      warranty_status: 'goodwill',
      customer_id: null,
      include_closed: 0,
    });
  });

  it('flags a load error', () => {
    api.getBoard.mockReturnValue(httpError(500));
    store.load();
    expect(store.error()).toBe(true);
    expect(store.isLoading()).toBe(false);
  });
});
