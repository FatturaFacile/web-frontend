import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import { PurchaseRequisitionSummary } from '@domain/procurement/purchase-requisition.models';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { PrConvertWorkbenchComponent } from './pr-convert-workbench.component';

function buildConvertibleSummaries(): {
  approved: PurchaseRequisitionSummary[];
  partial: PurchaseRequisitionSummary[];
} {
  return {
    approved: [
      {
        id: 'pr-a',
        requisition_number: 'PR-2026-0101',
        title: 'Bearings Batch A',
        status: 'approved',
        urgency: 'high',
        currency: 'EUR',
        estimated_total: 1000,
        requested_delivery_date: '2026-12-05',
        requester_id: 'u-1',
        requester_name: 'Elena Bianchi',
        cost_center_id: 'cc-1',
        cost_center_name: 'Production',
        project_id: 'proj-1',
        project_name: 'Line A',
        created_at: '2026-11-18T10:00:00Z',
        lines: [
          {
            id: 'pr-line-1',
            line_number: 1,
            catalog_item_id: 'cat-1',
            item_code: 'BRG-6204',
            description: 'SKF Bearing 6204',
            quantity: 10,
            converted_quantity: 0,
            remaining_quantity: 10,
            uom: 'PCS',
            estimated_unit_price: 50,
            line_total: 500,
          },
          {
            id: 'pr-line-done',
            line_number: 2,
            description: 'Already Exhausted Line',
            quantity: 5,
            converted_quantity: 5,
            remaining_quantity: 0,
            uom: 'PCS',
            estimated_unit_price: 100,
            line_total: 500,
          },
        ],
      },
    ],
    partial: [
      {
        id: 'pr-b',
        requisition_number: 'PR-2026-0102',
        title: 'Hydraulic Valves',
        status: 'partially_converted',
        urgency: 'critical',
        currency: 'EUR',
        estimated_total: 1200,
        requested_delivery_date: '2026-12-02',
        requester_id: 'u-2',
        requester_name: 'Luca Neri',
        cost_center_id: 'cc-2',
        cost_center_name: 'Maintenance',
        project_id: null,
        created_at: '2026-11-19T10:00:00Z',
        lines: [
          {
            id: 'pr-line-2',
            line_number: 1,
            catalog_item_id: 'cat-2',
            item_code: 'VLV-12',
            description: 'Hydraulic Valve 12mm',
            quantity: 8,
            converted_quantity: 3,
            remaining_quantity: 5,
            uom: 'PCS',
            estimated_unit_price: 150,
            line_total: 1200,
          },
        ],
      },
    ],
  };
}

describe('PrConvertWorkbenchComponent', () => {
  let fixture: ComponentFixture<PrConvertWorkbenchComponent>;
  let component: PrConvertWorkbenchComponent;
  let router: Router;
  let apiMock: {
    list: ReturnType<typeof vi.fn>;
    listCostCenters: ReturnType<typeof vi.fn>;
    listProjects: ReturnType<typeof vi.fn>;
    listRequesters: ReturnType<typeof vi.fn>;
    listQualifiedSuppliers: ReturnType<typeof vi.fn>;
    convert: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const data = buildConvertibleSummaries();
    apiMock = {
      list: vi.fn((filters?: { status?: string }) => {
        if (filters?.status === 'approved') {
          return of({ data: data.approved, meta: { total: 1 } });
        }
        return of({ data: data.partial, meta: { total: 1 } });
      }),
      listCostCenters: vi.fn().mockReturnValue(
        of([
          { id: 'cc-1', code: 'CC-1', name: 'Production', depth: 0, label: 'CC-1 — Production' },
          { id: 'cc-2', code: 'CC-2', name: 'Maintenance', depth: 0, label: 'CC-2 — Maintenance' },
        ]),
      ),
      listProjects: vi.fn().mockReturnValue(of([])),
      listRequesters: vi.fn().mockReturnValue(of([])),
      listQualifiedSuppliers: vi.fn().mockReturnValue(
        of([
          {
            id: 'sup-1',
            supplier_code: 'SUP-01',
            company_name: 'Alpine Industrial AG',
            label: 'SUP-01 — Alpine Industrial AG',
          },
        ]),
      ),
      convert: vi.fn().mockReturnValue(
        of({
          data: {
            target_type: 'rfq',
            target_id: 'rfq-99',
            rfq_id: 'rfq-99',
          },
        }),
      ),
    };

    TestBed.configureTestingModule({
      imports: [PrConvertWorkbenchComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: PurchaseRequisitionApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
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

    fixture = TestBed.createComponent(PrConvertWorkbenchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads only lines with remaining_quantity > 0 across approved and partially_converted PRs', () => {
    expect(component.allLines()).toHaveLength(2);
    expect(component.allLines().map((r) => r.line_id)).toEqual(['pr-line-1', 'pr-line-2']);
  });

  it('validates partial quantity splitting against remaining_quantity and blocks invalid quantities', () => {
    const [row1, row2] = component.allLines();
    component.toggleLineSelection(row1, true);
    component.toggleLineSelection(row2, true);
    fixture.detectChanges();

    expect(component.selectedCount()).toBe(2);
    expect(component.distinctRequisitionCount()).toBe(2);
    expect(component.canConvert()).toBe(true);

    // Exceeds remaining quantity (row2 has remaining 5)
    component.updateSplitQuantity(row2, 7);
    fixture.detectChanges();
    expect(component.quantityValidationState(row2)).toBe('exceeds_remaining');
    expect(component.canConvert()).toBe(false);

    // Non-positive quantity
    component.updateSplitQuantity(row2, 0);
    fixture.detectChanges();
    expect(component.quantityValidationState(row2)).toBe('non_positive');
    expect(component.canConvert()).toBe(false);

    // Valid partial split
    component.updateSplitQuantity(row2, 3);
    fixture.detectChanges();
    expect(component.quantityValidationState(row2)).toBe('valid');
    expect(component.isPartialSplit(row2)).toBe(true);
    expect(component.canConvert()).toBe(true);

    component.convertSelected();
    expect(apiMock.convert).toHaveBeenCalledWith({
      target_type: 'rfq',
      items: [
        { requisition_line_id: 'pr-line-1', quantity: 10 },
        { requisition_line_id: 'pr-line-2', quantity: 3 },
      ],
    });
    expect(router.navigate).toHaveBeenCalledWith(['/procurement/rfqs', 'rfq-99', 'edit']);
  });

  it('requires a supplier when converting to a Purchase Order and navigates to PO orders view', () => {
    const [row1] = component.allLines();
    component.toggleLineSelection(row1, true);
    component.targetType.set('po');
    fixture.detectChanges();

    expect(component.canConvert()).toBe(false);

    apiMock.convert.mockReturnValueOnce(
      of({
        data: {
          target_type: 'po',
          target_id: 'po-45',
          purchase_order_id: 'po-45',
        },
      }),
    );

    component.selectedSupplierId.set('sup-1');
    fixture.detectChanges();
    expect(component.canConvert()).toBe(true);

    component.convertSelected();
    expect(apiMock.convert).toHaveBeenCalledWith({
      target_type: 'po',
      supplier_id: 'sup-1',
      items: [{ requisition_line_id: 'pr-line-1', quantity: 10 }],
    });
    expect(router.navigate).toHaveBeenCalledWith(['/procurement/orders'], {
      queryParams: { poId: 'po-45' },
    });
  });

  it('filters lines by Cost Center and urgency', () => {
    component.costCenterFilter.set('cc-2');
    expect(component.filteredLines().map((r) => r.line_id)).toEqual(['pr-line-2']);

    component.costCenterFilter.set(null);
    component.urgencyFilter.set('high');
    expect(component.filteredLines().map((r) => r.line_id)).toEqual(['pr-line-1']);
  });
});
