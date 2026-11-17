import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryValuationApiService, LandedCostDocument, LandedCostStatus } from '@core';
import { httpError, inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { LandedCostDetailComponent } from './landed-cost-detail.component';

function doc(status: LandedCostStatus, extra: Partial<LandedCostDocument> = {}): LandedCostDocument {
  return {
    id: 'lc-1',
    number: 'LC-2026-0001',
    status,
    cost_type: 'freight',
    allocation_key: 'value',
    currency: 'EUR',
    total_amount: '300.00',
    document_date: '2026-11-15',
    supplier_invoice_id: null,
    receipts: [{ receipt_id: 'r-1', receipt_number: 'GR-1' }],
    allocations: [
      { receipt_id: 'r-1', item_id: 'i-1', lot_id: null, basis_value: '1000', allocated_amount: '300.00' },
    ],
    journal_entry_id: null,
    applied_at: null,
    reversal_of_id: null,
    ...extra,
  };
}

describe('LandedCostDetailComponent', () => {
  let api: {
    getLandedCost: ReturnType<typeof vi.fn>;
    applyLandedCost: ReturnType<typeof vi.fn>;
    reverseLandedCost: ReturnType<typeof vi.fn>;
  };
  const params = new BehaviorSubject(convertToParamMap({ id: 'lc-1' }));

  function create() {
    const fixture = TestBed.createComponent(LandedCostDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  const query = (el: HTMLElement, testId: string) => el.querySelector(`[data-testid="${testId}"]`);

  beforeEach(() => {
    api = {
      getLandedCost: vi.fn(() => of(doc('draft'))),
      applyLandedCost: vi.fn(() =>
        of(
          doc('applied', {
            journal_entry_id: 'je-1',
            applied_at: '2026-11-15T10:00:00Z',
            revaluation: { id: 'rv-1', total_inventory_delta: '180.00', total_cogs_delta: '120.00', journal_entry_id: 'je-1' },
          }),
        ),
      ),
      reverseLandedCost: vi.fn(() => of(doc('applied', { id: 'lc-2', number: 'LC-2026-0002', reversal_of_id: 'lc-1' }))),
    };
    TestBed.configureTestingModule({
      imports: [LandedCostDetailComponent],
      providers: [
        ...inventoryTestProviders(),
        { provide: InventoryValuationApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    });
  });

  it('shows apply (not reverse) for a draft document', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(api.getLandedCost).toHaveBeenCalledWith('lc-1');
    expect(query(el, 'apply-btn')).not.toBeNull();
    expect(query(el, 'reverse-btn')).toBeNull();
    expect(query(el, 'status-tag')?.textContent).toContain('INVENTORY.LANDED_COSTS.STATUS_DRAFT');
  });

  it('shows reverse (not apply) for an applied document', () => {
    api.getLandedCost.mockReturnValue(of(doc('applied')));
    const el = create().nativeElement as HTMLElement;
    expect(query(el, 'apply-btn')).toBeNull();
    expect(query(el, 'reverse-btn')).not.toBeNull();
  });

  it('is read-only once reversed', () => {
    api.getLandedCost.mockReturnValue(of(doc('reversed', { reversed_by_id: 'lc-2' })));
    const el = create().nativeElement as HTMLElement;
    expect(query(el, 'apply-btn')).toBeNull();
    expect(query(el, 'reverse-btn')).toBeNull();
    expect(query(el, 'reversal-link')).not.toBeNull();
  });

  it('applies a draft, becomes read-only and shows the revaluation; a second apply is impossible', () => {
    const fixture = create();
    const component = fixture.componentInstance;

    component.apply();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(api.applyLandedCost).toHaveBeenCalledTimes(1);
    expect(component.doc()?.status).toBe('applied');
    expect(query(el, 'apply-btn')).toBeNull();
    expect(query(el, 'revaluation')?.textContent).toContain('180.00');

    component.apply();
    expect(api.applyLandedCost).toHaveBeenCalledTimes(1);
  });

  it('reloads the document when apply answers 409', () => {
    const fixture = create();
    api.applyLandedCost.mockReturnValue(throwError(() => httpError(409, { message: 'Not a draft' })));
    api.getLandedCost.mockReturnValue(of(doc('applied')));

    fixture.componentInstance.apply();

    expect(api.getLandedCost).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.doc()?.status).toBe('applied');
    expect(fixture.componentInstance.applying()).toBe(false);
  });

  it('toasts a 422 (closed period) on apply and reloads the document', () => {
    const fixture = create();
    const error = vi.spyOn(TestBed.inject(NzMessageService), 'error');
    api.applyLandedCost.mockReturnValue(throwError(() => httpError(422, { message: 'Fiscal period 2026-11 is closed' })));

    fixture.componentInstance.apply();

    expect(error).toHaveBeenCalledWith('Fiscal period 2026-11 is closed');
    expect(api.getLandedCost).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.doc()?.status).toBe('draft');
  });

  it('requires a reason to reverse, then links to the reversal document', () => {
    api.getLandedCost.mockReturnValue(of(doc('applied')));
    const fixture = create();
    const component = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.openReverseModal();
    component.reverse();
    expect(api.reverseLandedCost).not.toHaveBeenCalled();

    component.reverseForm.controls.reason.setValue('  ');
    component.reverse();
    expect(api.reverseLandedCost).not.toHaveBeenCalled();

    component.reverseForm.controls.reason.setValue('Duplicate freight invoice');
    component.reverse();
    expect(api.reverseLandedCost).toHaveBeenCalledWith('lc-1', { reason: 'Duplicate freight invoice' });
    expect(component.reversalId()).toBe('lc-2');

    component.openReversal();
    expect(navigate).toHaveBeenCalledWith(['/inventory/landed-costs', 'lc-2']);
  });

  it('shows a translated error state on 404', () => {
    api.getLandedCost.mockReturnValue(throwError(() => httpError(404)));
    const fixture = create();
    expect(fixture.componentInstance.errorKey()).toBe('INVENTORY.ERRORS.NOT_FOUND');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('INVENTORY.ERRORS.NOT_FOUND');
  });

  it('keeps the reverse modal open with 422 messages', () => {
    api.getLandedCost.mockReturnValue(of(doc('applied')));
    api.reverseLandedCost.mockReturnValue(throwError(() => httpError(422, { message: 'Period is closed' })));
    const fixture = create();
    const component = fixture.componentInstance;

    component.openReverseModal();
    component.reverseForm.controls.reason.setValue('Wrong');
    component.reverse();

    expect(component.reverseModalOpen()).toBe(true);
    expect(component.reverseErrors()).toEqual(['Period is closed']);
  });
});
