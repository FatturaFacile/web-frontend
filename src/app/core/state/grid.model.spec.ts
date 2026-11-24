import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaginatedResponse } from '../models';
import { buildGridRows, FetchGridModel, GRID_EMPTY, GridValue } from './grid.model';

interface Row {
  id: number;
  status: string | null;
}

const meta = { current_page: 1, from: null, to: null, last_page: 1, per_page: 10, total: 2 };

function page(data: unknown[]): PaginatedResponse<Row> {
  return { success: true, message: '', data: data as Row[], meta };
}

describe('GridModel', () => {
  const calls: Record<string, unknown>[] = [];
  const loader = (params: Record<string, unknown>): Observable<PaginatedResponse<Row>> => {
    calls.push(params);
    if (params['grid_values']) {
      return of(page([{ value: 'draft', count: 7 }, { value: null, count: 1 }]));
    }
    return of(page([{ id: 1, status: 'draft' }]));
  };

  beforeEach(() => {
    calls.length = 0;
  });

  function create(): FetchGridModel<Row, never> {
    return TestBed.runInInjectionContext(() => new FetchGridModel<Row, never>(loader as never, 0));
  }

  it('asks the server for the values of a column over the whole dataset', async () => {
    const grid = create();
    const values = await new Promise<GridValue[]>((resolve) => grid.loadValues('status').subscribe(resolve));

    expect(values).toEqual([
      { value: 'draft', count: 7 },
      { value: null, count: 1 },
    ]);
    expect(calls.at(-1)).toEqual({ grid_values: 'status' });
  });

  it('caches the values until a reload', async () => {
    const grid = create();
    await new Promise((resolve) => grid.loadValues('status').subscribe(resolve));
    await new Promise((resolve) => grid.loadValues('status').subscribe(resolve));
    expect(calls.filter((c) => c['grid_values'] === 'status')).toHaveLength(1);

    grid.reload();
    await new Promise((resolve) => grid.loadValues('status').subscribe(resolve));
    expect(calls.filter((c) => c['grid_values'] === 'status')).toHaveLength(2);
  });

  it('groups on the server: the group column is part of the page query', () => {
    const grid = create();
    grid.toggleGroup('draft');
    grid.setGroupBy('status');

    expect(grid.groupBy()).toBe('status');
    expect(grid.collapsedGroups().size).toBe(0);
    expect(grid.pageIndex()).toBe(1);
  });
});

describe('buildGridRows', () => {
  const items: Row[] = [
    { id: 1, status: 'draft' },
    { id: 2, status: 'draft' },
    { id: 3, status: null },
  ];
  const summary: GridValue[] = [
    { value: 'draft', count: 40 },
    { value: null, count: 3 },
  ];

  it('returns the plain rows without a group column', () => {
    expect(buildGridRows(items, null, [], new Set()).map((r) => r.kind)).toEqual(['row', 'row', 'row']);
  });

  it('adds one header per group with the size over ALL rows, not the page', () => {
    const rows = buildGridRows(items, (i) => i.status, summary, new Set());

    expect(rows.map((r) => r.kind)).toEqual(['group', 'row', 'row', 'group', 'row']);
    expect(rows[0]).toMatchObject({ label: 'draft', count: 40, collapsed: false });
    expect(rows[3]).toMatchObject({ key: GRID_EMPTY, label: '—', count: 3 });
  });

  it('hides the rows of a collapsed group', () => {
    const rows = buildGridRows(items, (i) => i.status, summary, new Set(['draft']));

    expect(rows.filter((r) => r.kind === 'row').map((r) => r.kind === 'row' && r.hidden)).toEqual([true, true, false]);
  });
});
