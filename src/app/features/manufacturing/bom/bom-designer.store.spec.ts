import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { beforeEach, describe, expect, it } from 'vitest';
import { BomExplosion } from '@core';
import { BomDesignerStore } from './bom-designer.store';

const base = `${environment.apiBaseUrl}/manufacturing`;

const EXPLOSION: BomExplosion = {
  total_lead_time_days: 5,
  lines: [
    {
      level: 1, item_id: 'i-a', item_code: 'A', net_quantity: '2', variable_waste_quantity: '0', fixed_waste_quantity: '0',
      effective_quantity: '2', is_phantom: false, has_bom: true, path: ['A'],
    },
    {
      level: 2, item_id: 'i-a1', item_code: 'A1', net_quantity: '4', variable_waste_quantity: '0', fixed_waste_quantity: '0',
      effective_quantity: '4', is_phantom: true, has_bom: false, unit_cost: '2', path: ['A', 'A1'],
    },
    {
      level: 1, item_id: 'i-b', item_code: 'B', net_quantity: '3', variable_waste_quantity: '0', fixed_waste_quantity: '0',
      effective_quantity: '3', is_phantom: false, has_bom: false, unit_cost: '1', path: ['B'],
    },
  ],
};

describe('BomDesignerStore', () => {
  let store: BomDesignerStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(BomDesignerStore);
    http = TestBed.inject(HttpTestingController);
  });

  function load(): void {
    store.load('bom-1', 2).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/boms/bom-1/explosion`);
    expect(req.request.params.get('quantity')).toBe('2');
    expect(req.request.params.get('multi_level')).toBe('1');
    expect(req.request.params.get('flatten_phantoms')).toBe('0');
    req.flush({ success: true, message: 'OK', data: EXPLOSION });
  }

  it('loads the explosion as an expanded tree with the cost rollup', () => {
    load();

    expect(store.loading()).toBe(false);
    expect(store.rows().map((n) => n.line.item_code)).toEqual(['A', 'A1', 'B']);
    expect(store.totalCost()).toBe(11);
    expect(store.leadTimeDays()).toBe(5);

    store.toggle(store.tree()[0].key);
    expect(store.rows().map((n) => n.line.item_code)).toEqual(['A', 'B']);
    store.expandAll();
    expect(store.rows()).toHaveLength(3);
    store.collapseAll();
    expect(store.rows()).toHaveLength(2);
  });

  it('only lets the direct components be edited and previews the cost of an edit', () => {
    load();
    const [a, b] = store.tree();

    expect(store.isEditable(a)).toBe(true);
    expect(store.isEditable(a.children[0])).toBe(false);

    store.edit(b, 'quantity_per', '4');
    store.edit(b, 'fixed_scrap_quantity', '1');

    expect(store.hasPending()).toBe(true);
    // net 4 x 2 (quantity) = 8, plus 1 fixed waste, at unit cost 1
    expect(store.costOf(b)).toBe(9);
    expect(store.totalCost()).toBe(17);

    store.discardEdits();
    expect(store.hasPending()).toBe(false);
    expect(store.totalCost()).toBe(11);
  });

  it('reorders direct components and renumbers their sequences', () => {
    load();
    const b = store.tree()[1];

    store.move(b, -1);

    expect(store.rows().map((n) => n.line.item_code)).toEqual(['B', 'A', 'A1']);
    expect(store.hasPending()).toBe(true);

    store.saveRevision('Resequence').subscribe();
    const req = http.expectOne(`${base}/boms/revisions`);
    expect(req.request.body).toEqual({
      source_bom_id: 'bom-1',
      reason: 'Resequence',
      components: [
        { action: 'update', component_item_id: 'i-b', sequence: 10 },
        { action: 'update', component_item_id: 'i-a', sequence: 20 },
      ],
    });
    req.flush({ data: { id: 'bom-2' }, engineering_change: { id: 'eco-1', status: 'draft' } });

    expect(store.hasPending()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('ignores a move past the ends', () => {
    load();
    store.move(store.tree()[0], -1);

    expect(store.hasPending()).toBe(false);
  });

  it('loads the EUR.1 result with the threshold', () => {
    load();
    store.loadOrigin(40).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/boms/bom-1/preferential-origin`);
    expect(req.request.params.get('threshold_percentage')).toBe('40');
    req.flush({ data: { qualifies: true, non_originating_percentage: '32.5' } });

    expect(store.origin()?.qualifies).toBe(true);
  });
});
