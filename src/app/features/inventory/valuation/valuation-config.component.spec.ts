import { TestBed } from '@angular/core/testing';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingApiService, InventoryValuationApiService, ValuationConfigRow } from '@core';
import { httpError, inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { ValuationConfigComponent } from './valuation-config.component';

const ROWS: ValuationConfigRow[] = [
  {
    item_id: 'i-1',
    sku: 'SKU-1',
    name: 'Bolt',
    category_id: 'c-1',
    category_name: 'Hardware',
    category_method: 'fifo',
    item_method: 'weighted_average',
    effective_method: 'weighted_average',
    source: 'item',
  },
  {
    item_id: 'i-2',
    sku: 'SKU-2',
    name: 'Nut',
    category_id: 'c-1',
    category_name: 'Hardware',
    category_method: 'fifo',
    item_method: null,
    effective_method: 'fifo',
    source: 'category',
  },
];

describe('ValuationConfigComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let confirm: ReturnType<typeof vi.fn>;

  function create() {
    const fixture = TestBed.createComponent(ValuationConfigComponent);
    // NzModalModule provides NzModalService at component level: stub that instance.
    vi.spyOn(fixture.debugElement.injector.get(NzModalService), 'confirm').mockImplementation(
      confirm as unknown as NzModalService['confirm'],
    );
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = {
      getValuationConfig: vi.fn(() => of(ROWS)),
      getValuationSummary: vi.fn(() =>
        of({ valuation_method: 'FIFO', warehouse_id: null, total_valuation: '1500.00', items_count: 2, items: [] }),
      ),
      listWarehouses: vi.fn(() => of([])),
      updateItemValuation: vi.fn(() =>
        of({
          id: 'i-2',
          valuation_method: 'standard_cost',
          revaluation: { id: 'rv-1', total_inventory_delta: '-12.00', total_cogs_delta: '0.00', journal_entry_id: 'je-1' },
        }),
      ),
      updateCategoryValuation: vi.fn(() => of({ id: 'c-1', valuation_method: 'weighted_average' })),
      captureValuationSnapshot: vi.fn(() => of({})),
    };
    // Auto-confirm the revaluation dialog.
    confirm = vi.fn((opts: { nzOnOk?: () => void }) => opts.nzOnOk?.());
    TestBed.configureTestingModule({
      imports: [ValuationConfigComponent],
      providers: [
        ...inventoryTestProviders(),
        { provide: InventoryValuationApiService, useValue: api },
        { provide: AccountingApiService, useValue: { getChartOfAccounts: vi.fn(() => of({ data: [] })) } },
      ],
    });
  });

  it('shows the effective method with its source for each item', () => {
    const fixture = create();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('INVENTORY.VALUATION.METHOD_WEIGHTED_AVERAGE');
    expect(rows[0].textContent).toContain('INVENTORY.VALUATION.SOURCE_ITEM');
    expect(rows[1].textContent).toContain('INVENTORY.VALUATION.METHOD_FIFO');
    expect(rows[1].textContent).toContain('INVENTORY.VALUATION.SOURCE_CATEGORY');
    expect(fixture.componentInstance.categories()).toEqual([
      { id: 'c-1', name: 'Hardware', method: 'fifo', items: 2 },
    ]);
  });

  it('confirms and persists an inline method change through PUT valuation/items/{id}', () => {
    const fixture = create();
    const component = fixture.componentInstance;

    component.changeItemMethod(ROWS[1], 'standard_cost');

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api['updateItemValuation']).toHaveBeenCalledWith('i-2', {
      valuation_method: 'standard_cost',
      revalue_on_change: true,
    });
    expect(component.lastRevaluation()?.total_inventory_delta).toBe('-12.00');
    expect(api['getValuationConfig']).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the selected method is unchanged', () => {
    const fixture = create();
    fixture.componentInstance.changeItemMethod(ROWS[0], 'weighted_average');
    expect(confirm).not.toHaveBeenCalled();
    expect(api['updateItemValuation']).not.toHaveBeenCalled();
  });

  it('binds 422 errors of the item modal to the form', () => {
    api['updateItemValuation'].mockReturnValue(
      throwError(() => httpError(422, { message: 'x', errors: { standard_cost: ['Required for standard cost'] } })),
    );
    const fixture = create();
    const component = fixture.componentInstance;

    component.openItemModal(ROWS[1]);
    component.itemForm.controls.valuation_method.setValue('standard_cost');
    component.submitItem();

    expect(confirm).toHaveBeenCalled();
    expect(component.itemForm.controls.standard_cost.errors).toEqual({ serverError: 'Required for standard cost' });
    expect(component.itemModalOpen()).toBe(true);
  });

  it('saves weights without a revaluation prompt when the method is unchanged', () => {
    const fixture = create();
    const component = fixture.componentInstance;

    component.openItemModal(ROWS[0]);
    component.itemForm.controls.weight_kg.setValue('1.2500');
    component.submitItem();

    expect(confirm).not.toHaveBeenCalled();
    expect(api['updateItemValuation']).toHaveBeenCalledWith('i-1', {
      valuation_method: 'weighted_average',
      standard_cost: null,
      weight_kg: '1.2500',
      volume_m3: null,
      revalue_on_change: false,
    });
  });

  it('rejects malformed decimals client-side', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    component.openItemModal(ROWS[0]);
    component.itemForm.controls.weight_kg.setValue('1,5');
    component.submitItem();
    expect(api['updateItemValuation']).not.toHaveBeenCalled();
  });

  it('updates a category method through PUT valuation/categories/{id}', () => {
    const fixture = create();
    const component = fixture.componentInstance;

    component.openCategoryModal(component.categories()[0]);
    component.categoryForm.controls.valuation_method.setValue('weighted_average');
    component.submitCategory();

    expect(api['updateCategoryValuation']).toHaveBeenCalledWith('c-1', {
      valuation_method: 'weighted_average',
      inventory_account_id: undefined,
      cogs_account_id: undefined,
      ppv_account_id: undefined,
      landed_cost_clearing_account_id: undefined,
    });
  });

  it('shows a translated error state when the config cannot be loaded', () => {
    api['getValuationConfig'].mockReturnValue(throwError(() => httpError(403)));
    const fixture = create();
    expect(fixture.componentInstance.loadErrorKey()).toBe('INVENTORY.ERRORS.FORBIDDEN');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('INVENTORY.ERRORS.FORBIDDEN');
  });
});
