import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryValuationApiService } from '@core';
import { inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { LandedCostListComponent } from './landed-cost-list.component';

describe('LandedCostListComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listLandedCosts: vi.fn(() =>
        of({
          success: true,
          message: '',
          data: [
            {
              id: 'lc-1',
              number: 'LC-2026-0001',
              status: 'applied',
              cost_type: 'freight',
              allocation_key: 'value',
              currency: 'EUR',
              total_amount: '300.00',
              document_date: '2026-11-15',
            },
          ],
          meta: { total: 1 },
        }),
      ),
      listGoodsReceipts: vi.fn(() => of({ data: [{ id: 'r-1', receipt_number: 'GR-1' }], meta: { total: 1 } })),
    };
    TestBed.configureTestingModule({
      imports: [LandedCostListComponent],
      providers: [...inventoryTestProviders(), { provide: InventoryValuationApiService, useValue: api }],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('lists documents with a link to the detail page and their status', () => {
    const fixture = TestBed.createComponent(LandedCostListComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector('tbody a') as HTMLAnchorElement;
    expect(link.textContent).toContain('LC-2026-0001');
    expect(link.getAttribute('href')).toBe('/inventory/landed-costs/lc-1');
    expect(el.textContent).toContain('INVENTORY.LANDED_COSTS.STATUS_APPLIED');
  });

  it('sends status / receipt / date filters', () => {
    const fixture = TestBed.createComponent(LandedCostListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    vi.advanceTimersByTime(1);

    component.setStatus('draft');
    component.setReceipt('r-1');
    component.setDateRange([new Date(2026, 0, 1), new Date(2026, 11, 31)]);
    fixture.detectChanges();
    vi.advanceTimersByTime(400);

    expect(api['listLandedCosts']).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'draft', receipt_id: 'r-1', from: '2026-01-01', to: '2026-12-31' }),
    );
  });
});
