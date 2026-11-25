import { TestBed } from '@angular/core/testing';
import { SrmApiService } from '@data-access/procurement/srm-api.service';
import { DocumentFlow, SrmDashboard, SupplierRatingPage } from '@domain/procurement/srm.models';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SrmStore } from './srm.store';

function setup(api: Partial<SrmApiService>) {
  TestBed.configureTestingModule({
    providers: [SrmStore, { provide: SrmApiService, useValue: api }],
  });
  return TestBed.inject(SrmStore);
}

describe('SrmStore', () => {
  it('keeps the dashboard and clears the loading flag', () => {
    const dashboard = { orders: { open: 2 } } as SrmDashboard;
    const store = setup({ dashboard: vi.fn(() => of(dashboard)) });

    store.loadDashboard({ from: '2026-01-01' });

    expect(store.dashboard()).toBe(dashboard);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('stores the error message when the dashboard fails', () => {
    const store = setup({
      dashboard: vi.fn(() => throwError(() => ({ error: { message: 'Boom' } }))),
    });

    store.loadDashboard();

    expect(store.dashboard()).toBeNull();
    expect(store.error()).toBe('Boom');
    expect(store.loading()).toBe(false);
  });

  it('keeps the scorecard page and its meta', () => {
    const page = {
      data: [{ supplier_id: 's-1', tier: 'A' }],
      meta: { current_page: 1, per_page: 20, total: 1, last_page: 1, from: 1, to: 1 },
    } as SupplierRatingPage;
    const scorecards = vi.fn(() => of(page));
    const store = setup({ scorecards });

    store.loadScorecards({ page: 1, per_page: 20, sort: 'name', direction: 'asc' });

    expect(scorecards).toHaveBeenCalledWith({
      page: 1,
      per_page: 20,
      sort: 'name',
      direction: 'asc',
    });
    expect(store.scorecards()).toEqual(page.data);
    expect(store.scorecardsMeta()?.total).toBe(1);
  });

  it('replaces the previous document flow and reloads with the requested document', () => {
    const flow = {
      anchor: { type: 'purchase_order', id: 'po-2' },
      nodes: [],
    } as unknown as DocumentFlow;
    const documentFlow = vi.fn(() => of(flow));
    const store = setup({ documentFlow });

    store.loadFlow('purchase_order', 'po-2');

    expect(documentFlow).toHaveBeenCalledWith('purchase_order', 'po-2');
    expect(store.flow()).toBe(flow);
  });

  it('clears the flow and reports the error when it cannot be loaded', () => {
    const store = setup({
      documentFlow: vi.fn(() => throwError(() => ({ error: { message: 'Not found' } }))),
    });

    store.loadFlow('rfq', 'rfq-9');

    expect(store.flow()).toBeNull();
    expect(store.error()).toBe('Not found');
  });
});
