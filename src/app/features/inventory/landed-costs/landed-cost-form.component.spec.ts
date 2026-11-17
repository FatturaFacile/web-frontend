import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryValuationApiService, LandedCostPreview } from '@core';
import { httpError, inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { LANDED_COST_PREVIEW_DEBOUNCE_MS, LandedCostFormComponent } from './landed-cost-form.component';

const PREVIEW: LandedCostPreview = {
  allocations: [
    { receipt_id: 'r-1', item_id: 'i-1', lot_id: null, basis_value: '1000.0000', allocated_amount: '200.00' },
    { receipt_id: 'r-2', item_id: 'i-2', lot_id: null, basis_value: '500.0000', allocated_amount: '100.00' },
  ],
  totals: { allocated: '300.00', difference: '0.00' },
};

describe('LandedCostFormComponent', () => {
  let api: {
    previewLandedCost: ReturnType<typeof vi.fn>;
    createLandedCost: ReturnType<typeof vi.fn>;
    listGoodsReceipts: ReturnType<typeof vi.fn>;
  };

  function create() {
    const fixture = TestBed.createComponent(LandedCostFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  function fillValidDraft(component: LandedCostFormComponent) {
    component.form.patchValue({ allocation_key: 'value', cost_type: 'freight' });
    component.form.controls.receipt_ids.setValue(['r-1', 'r-2']);
    component.form.controls.total_amount.setValue('3');
    component.form.controls.total_amount.setValue('30');
    component.form.controls.total_amount.setValue('300');
  }

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      previewLandedCost: vi.fn(() => of(PREVIEW)),
      createLandedCost: vi.fn(() => of({ id: 'lc-9', status: 'draft' })),
      listGoodsReceipts: vi.fn(() =>
        of({ data: [{ id: 'r-1', receipt_number: 'GR-1' }, { id: 'r-2', receipt_number: 'GR-2' }], meta: { total: 2 } }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [LandedCostFormComponent],
      providers: [...inventoryTestProviders(), { provide: InventoryValuationApiService, useValue: api }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a single debounced preview for a burst of valid changes and persists nothing', () => {
    const fixture = create();
    const component = fixture.componentInstance;

    fillValidDraft(component);
    vi.advanceTimersByTime(LANDED_COST_PREVIEW_DEBOUNCE_MS - 1);
    expect(api.previewLandedCost).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(api.previewLandedCost).toHaveBeenCalledTimes(1);
    expect(api.previewLandedCost).toHaveBeenCalledWith(
      expect.objectContaining({
        total_amount: '300',
        allocation_key: 'value',
        receipt_ids: ['r-1', 'r-2'],
        currency: 'EUR',
      }),
    );
    expect(component.preview()).toEqual(PREVIEW);
    expect(api.createLandedCost).not.toHaveBeenCalled();

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('INVENTORY.LANDED_COSTS.ALLOCATED_TOTAL');
    expect(text).toContain('GR-1');
  });

  it('does not preview an invalid draft (no receipt or non-positive amount)', () => {
    const fixture = create();
    const component = fixture.componentInstance;

    component.form.controls.total_amount.setValue('0.00');
    component.form.controls.receipt_ids.setValue(['r-1']);
    vi.advanceTimersByTime(LANDED_COST_PREVIEW_DEBOUNCE_MS * 2);
    component.form.controls.total_amount.setValue('300');
    component.form.controls.receipt_ids.setValue([]);
    vi.advanceTimersByTime(LANDED_COST_PREVIEW_DEBOUNCE_MS * 2);

    expect(api.previewLandedCost).not.toHaveBeenCalled();
    expect(component.preview()).toBeNull();
  });

  it('lists 422 preview errors inline (e.g. missing weight_kg)', () => {
    api.previewLandedCost.mockReturnValue(
      throwError(() =>
        httpError(422, {
          message: 'The given data was invalid.',
          errors: { allocation_key: ['Item SKU-1 has no weight_kg'] },
        }),
      ),
    );
    const fixture = create();
    const component = fixture.componentInstance;

    fillValidDraft(component);
    component.form.controls.allocation_key.setValue('weight');
    vi.advanceTimersByTime(LANDED_COST_PREVIEW_DEBOUNCE_MS);

    expect(component.previewErrors()).toEqual(['Item SKU-1 has no weight_kg']);
    expect(component.preview()).toBeNull();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Item SKU-1 has no weight_kg');
    expect(api.createLandedCost).not.toHaveBeenCalled();
  });

  it('creates the draft on submit and navigates to its detail', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fillValidDraft(component);
    component.submit();

    expect(api.createLandedCost).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/inventory/landed-costs', 'lc-9']);
  });

  it('binds 422 errors from create to the form', () => {
    api.createLandedCost.mockReturnValue(
      throwError(() => httpError(422, { message: 'x', errors: { total_amount: ['Amount too large'] } })),
    );
    const fixture = create();
    const component = fixture.componentInstance;

    fillValidDraft(component);
    component.submit();

    expect(component.form.controls.total_amount.errors).toEqual({ serverError: 'Amount too large' });
    expect(component.saving()).toBe(false);
  });

  it('does not submit an invalid form', () => {
    const fixture = create();
    fixture.componentInstance.submit();
    expect(api.createLandedCost).not.toHaveBeenCalled();
  });
});
