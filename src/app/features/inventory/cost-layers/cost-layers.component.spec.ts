import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CostLayer, InventoryValuationApiService } from '@core';
import { inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { CostLayersComponent } from './cost-layers.component';

const LAYERS: CostLayer[] = [
  {
    id: 'l-1',
    item_id: 'i-1',
    sku: 'SKU-1',
    lot_id: null,
    received_at: '2026-03-01T00:00:00Z',
    original_quantity: '10.0000',
    remaining_quantity: '6.0000',
    unit_cost: '5.0000',
    landed_cost_unit: '0.5000',
    effective_unit_cost: '5.5000',
    receipt_id: 'r-1',
  },
  {
    id: 'l-2',
    item_id: 'i-1',
    sku: 'SKU-1',
    lot_id: null,
    received_at: '2026-02-01T00:00:00Z',
    original_quantity: '10.0000',
    remaining_quantity: '0.0000',
    unit_cost: '4.0000',
    landed_cost_unit: '0.0000',
    effective_unit_cost: '4.0000',
    receipt_id: null,
  },
];

describe('CostLayersComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      getCostLayers: vi.fn(() => of({ success: true, message: '', data: LAYERS, meta: { total: 2 } })),
      listWarehouses: vi.fn(() => of([{ id: 'w-1', name: 'Chiasso' }])),
      searchItems: vi.fn(() => of([{ id: 'i-1', sku: 'SKU-1' }])),
    };
    TestBed.configureTestingModule({
      imports: [CostLayersComponent],
      providers: [...inventoryTestProviders(), { provide: InventoryValuationApiService, useValue: api }],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('renders layers with remaining quantity and effective (landed) unit cost', () => {
    const fixture = TestBed.createComponent(CostLayersComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('6');
    expect(rows[0].textContent).toContain('5.5000');
    expect(rows[1].textContent).toContain('INVENTORY.COST_LAYERS.DEPLETED');
  });

  it('applies item / warehouse / lot / open-only filters to the request', () => {
    const fixture = TestBed.createComponent(CostLayersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    vi.advanceTimersByTime(1);

    component.setItem('i-1');
    component.setWarehouse('w-1');
    component.setOpenOnly(true);
    component.setLot({ target: { value: ' LOT-7 ' } } as unknown as Event);
    fixture.detectChanges();
    vi.advanceTimersByTime(400);

    expect(api['getCostLayers']).toHaveBeenLastCalledWith(
      expect.objectContaining({ item_id: 'i-1', warehouse_id: 'w-1', lot_id: 'LOT-7', open_only: true, page: 1 }),
    );
  });
});
