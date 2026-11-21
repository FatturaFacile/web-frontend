import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import { PrBudgetCheckSnapshot, PurchaseRequisitionDetail } from '@domain/procurement/purchase-requisition.models';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { PrFormPageComponent } from './pr-form-page.component';
import { PurchaseRequisitionStore } from './purchase-requisition.store';

describe('PrFormPageComponent', () => {
  let fixture: ComponentFixture<PrFormPageComponent>;
  let component: PrFormPageComponent;
  let router: Router;
  let apiMock: {
    listCostCenters: ReturnType<typeof vi.fn>;
    listProjects: ReturnType<typeof vi.fn>;
    listRequesters: ReturnType<typeof vi.fn>;
    listQualifiedSuppliers: ReturnType<typeof vi.fn>;
    listCatalogItems: ReturnType<typeof vi.fn>;
    budgetPreview: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    submit: ReturnType<typeof vi.fn>;
    listPendingApprovals: ReturnType<typeof vi.fn>;
  };

  const budgetOk: PrBudgetCheckSnapshot = {
    cost_center_id: 'cc-1',
    currency: 'CHF',
    allocated_budget: 10000,
    committed_amount: 2000,
    available_budget: 8000,
    requisition_amount: 1200,
    remaining_after_requisition: 6800,
    utilization_percent: 32,
    status: 'ok',
  };

  const budgetHardBlock: PrBudgetCheckSnapshot = {
    cost_center_id: 'cc-1',
    currency: 'CHF',
    allocated_budget: 10000,
    committed_amount: 9500,
    available_budget: 500,
    requisition_amount: 1200,
    remaining_after_requisition: -700,
    utilization_percent: 107,
    status: 'hard_block',
    is_hard_blocked: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();

    apiMock = {
      listCostCenters: vi.fn().mockReturnValue(
        of([{ id: 'cc-1', code: 'CC-IT', name: 'IT Infrastructure', depth: 0, label: 'CC-IT — IT Infrastructure' }]),
      ),
      listProjects: vi.fn().mockReturnValue(
        of([{ id: 'proj-1', project_number: 'PRJ-01', name: 'ERP Rollout', label: 'PRJ-01 — ERP Rollout' }]),
      ),
      listRequesters: vi.fn().mockReturnValue(of([])),
      listQualifiedSuppliers: vi.fn().mockReturnValue(of([])),
      listCatalogItems: vi.fn().mockReturnValue(
        of([
          {
            id: 'cat-1',
            sku: 'MON-27',
            name: 'Dell 27 Monitor',
            unit_measure: 'PCS',
            cost_price: 420.5,
            label: 'MON-27 — Dell 27 Monitor',
          },
        ]),
      ),
      budgetPreview: vi.fn().mockReturnValue(of({ data: budgetOk })),
      create: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'pr-new-1',
            requisition_number: 'PR-2026-0099',
            status: 'draft',
          } as PurchaseRequisitionDetail,
        }),
      ),
      submit: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'pr-new-1',
            requisition_number: 'PR-2026-0099',
            status: 'pending_approval',
          } as PurchaseRequisitionDetail,
        }),
      ),
      listPendingApprovals: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0 } })),
    };

    TestBed.configureTestingModule({
      imports: [PrFormPageComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: PurchaseRequisitionApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
        {
          provide: AuthStore,
          useValue: {
            activeCurrency: signal<'CHF'>('CHF'),
            user: signal({ id: 'usr-1', name: 'Marco Rossi' }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: signal<'en'>('en'),
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PrFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(PurchaseRequisitionStore).clearBudgetPreview();
  });

  it('computes line subtotals and grand total accurately across catalog and free-text lines', () => {
    component.onCatalogItemSelected(0, 'cat-1');
    component.linesArray.at(0).controls.quantity.setValue(3);
    fixture.detectChanges();

    expect(component.linesArray.at(0).controls.item_code.value).toBe('MON-27');
    expect(component.linesArray.at(0).controls.description.value).toBe('Dell 27 Monitor');
    expect(component.lineSubtotal(0)).toBe(1261.5);
    expect(component.grandTotal()).toBe(1261.5);

    component.addLine();
    component.setLineMode(1, 'free_text');
    component.linesArray.at(1).patchValue({
      description: 'On-site installation',
      quantity: 2,
      uom: 'HRS',
      estimated_unit_price: 99.99,
    });
    fixture.detectChanges();

    expect(component.lineSubtotal(1)).toBe(199.98);
    expect(component.grandTotal()).toBe(1461.48);
  });

  it('switches line mode from catalog to free-text and clears catalog_item_id', () => {
    component.onCatalogItemSelected(0, 'cat-1');
    expect(component.linesArray.at(0).controls.catalog_item_id.value).toBe('cat-1');

    component.setLineMode(0, 'free_text');
    expect(component.lineMode(0)).toBe('free_text');
    expect(component.linesArray.at(0).controls.catalog_item_id.value).toBeNull();
  });

  it('debounces live budget preview calls on cost center and line total changes, and blocks submission on hard block', async () => {
    component.form.patchValue({
      title: 'Server Rack Expansion',
      cost_center_id: 'cc-1',
      currency: 'CHF',
      economic_justification: 'Capacity expansion',
    });
    component.onCatalogItemSelected(0, 'cat-1');
    component.linesArray.at(0).controls.quantity.setValue(2);

    vi.advanceTimersByTime(400);
    fixture.detectChanges();

    expect(apiMock.budgetPreview).toHaveBeenCalledWith({
      cost_center_id: 'cc-1',
      currency: 'CHF',
      exclude_requisition_id: null,
      lines: [
        {
          quantity: 2,
          estimated_unit_price: 420.5,
          cost_center_id: 'cc-1',
        },
      ],
    });
    expect(component.isSubmitDisabled()).toBe(false);

    apiMock.budgetPreview.mockReturnValueOnce(of({ data: budgetHardBlock }));
    component.linesArray.at(0).controls.quantity.setValue(5);
    vi.advanceTimersByTime(400);
    fixture.detectChanges();

    expect(component.store.isBudgetHardBlocked()).toBe(true);
    expect(component.isSubmitDisabled()).toBe(true);

    // Save Draft remains allowed even under a hard budget block
    await component.saveDraft();
    expect(apiMock.create).toHaveBeenCalledTimes(1);
    expect(apiMock.submit).not.toHaveBeenCalled();
  });

  it('saves and submits a valid requisition when budget is within limit', async () => {
    component.form.patchValue({
      title: 'Workstation Monitors',
      cost_center_id: 'cc-1',
      project_id: 'proj-1',
      currency: 'CHF',
      economic_justification: 'New engineering hires',
    });
    component.onCatalogItemSelected(0, 'cat-1');
    vi.advanceTimersByTime(400);
    fixture.detectChanges();

    await component.submitForApproval();

    expect(apiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Workstation Monitors',
        cost_center_id: 'cc-1',
        project_id: 'proj-1',
        currency: 'CHF',
        lines: [
          expect.objectContaining({
            item_type: 'catalog_item',
            catalog_item_id: 'cat-1',
            unit_of_measure: 'PCS',
            quantity: 1,
            estimated_unit_price: 420.5,
          }),
        ],
      }),
    );
    expect(apiMock.submit).toHaveBeenCalledWith('pr-new-1');
    expect(router.navigate).toHaveBeenCalledWith(['/procurement/requisitions', 'pr-new-1']);
  });
});
