import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  ManufacturingApiService,
  MfgBomResource,
  MfgMrpRunResource,
  MfgPlannedOrderResource,
  MfgProductionOrderResource,
  MfgShortageResource,
  MfgWorkCenterResource,
} from '@core';
import { ManufacturingComponent } from './manufacturing.component';

describe('ManufacturingComponent', () => {
  let component: ManufacturingComponent;
  let fixture: ComponentFixture<ManufacturingComponent>;
  let apiService: Partial<ManufacturingApiService>;
  let messageService: Partial<NzMessageService>;

  const mockOrder: MfgProductionOrderResource = {
    id: 'po-1',
    order_number: 'PO-2026-001',
    mfg_item_id: 'item-1',
    status: 'planned',
    target_quantity: 10,
    completed_quantity: 0,
    scrapped_quantity: 0,
    uom: 'PZ',
    planned_start_date: '2026-04-01T08:00:00Z',
    planned_end_date: '2026-04-05T17:00:00Z',
  };

  const mockBom: MfgBomResource = {
    id: 'bom-1',
    bom_number: 'BOM-001',
    mfg_item_id: 'item-1',
    name: 'Distinta Base 1',
    revision: 'A',
    status: 'draft',
    base_quantity: 1,
    uom: 'PZ',
  };

  const mockMrpRun: MfgMrpRunResource = {
    id: 'mrp-1',
    run_number: 'MRP-2026-001',
    run_type: 'regenerative',
    status: 'completed',
    horizon_start_date: '2026-04-01',
    horizon_end_date: '2026-06-30',
    total_items_processed: 25,
    total_planned_orders: 5,
    total_shortages: 2,
  };

  const mockPlannedOrder: MfgPlannedOrderResource = {
    id: 'plan-1',
    planned_order_number: 'PLN-001',
    mrp_run_id: 'mrp-1',
    mfg_item_id: 'item-1',
    order_type: 'make',
    quantity: 10,
    net_requirement: 10,
    bom_level: 1,
    uom: 'PZ',
    start_date: '2026-04-01',
    due_date: '2026-04-10',
    status: 'planned',
    bom_id: null,
    routing_id: null,
    converted_order_id: null,
    converted_at: null,
  };

  const mockShortage: MfgShortageResource = {
    id: 'short-1',
    mrp_run_id: 'mrp-1',
    mfg_item_id: 'item-comp-1',
    required_date: '2026-04-05',
    gross_requirement: 20,
    available_inventory: 5,
    scheduled_receipts: 0,
    safety_stock: 5,
    net_shortage: 20,
    recommended_action: 'Emetti Ordine Acquisto',
  };

  const mockWorkCenter: MfgWorkCenterResource = {
    id: 'wc-1',
    work_center_code: 'WC-01',
    name: 'Linea Assemblaggio',
    capacity_hours_per_day: 8,
    status: 'active',
  };

  beforeEach(async () => {
    apiService = {
      getProductionOrders: vi.fn().mockReturnValue(of({ data: [mockOrder], meta: { total: 1 } })),
      createProductionOrder: vi.fn().mockReturnValue(of({ data: mockOrder })),
      releaseProductionOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'released' } })),
      startProductionOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'in_progress' } })),
      completeProductionOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'completed' } })),
      closeProductionOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'closed' } })),
      cancelProductionOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'cancelled' } })),
      getBoms: vi.fn().mockReturnValue(of({ data: [mockBom], meta: { total: 1 } })),
      createBom: vi.fn().mockReturnValue(of({ data: mockBom })),
      activateBom: vi.fn().mockReturnValue(of({ data: { ...mockBom, status: 'active' } })),
      reviseBom: vi.fn().mockReturnValue(of({ data: { ...mockBom, revision: 'B' } })),
      explodeBom: vi.fn().mockReturnValue(of({ data: { tree: 'exploded' } })),
      getMrpRuns: vi.fn().mockReturnValue(of({ data: [mockMrpRun], meta: { total: 1 } })),
      runMrp: vi.fn().mockReturnValue(of({ data: mockMrpRun })),
      getPlannedOrders: vi.fn().mockReturnValue(of({ data: [mockPlannedOrder], meta: { total: 1 } })),
      convertPlannedOrder: vi.fn().mockReturnValue(of({ data: mockOrder })),
      getShortages: vi.fn().mockReturnValue(of({ data: [mockShortage], meta: { total: 1 } })),
      getWorkCenters: vi.fn().mockReturnValue(of({ data: [mockWorkCenter], meta: { total: 1 } })),
      createWorkCenter: vi.fn().mockReturnValue(of({ data: mockWorkCenter })),
      getRoutings: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0 } })),
    };

    messageService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ManufacturingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: ManufacturingApiService, useValue: apiService },
        { provide: NzMessageService, useValue: messageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManufacturingComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as unknown as { modal: { confirm: (opts: { nzOnOk?: () => void }) => NzModalRef } }).modal, 'confirm').mockImplementation(config => {
      if (config.nzOnOk) config.nzOnOk();
      return {} as NzModalRef;
    });
    fixture.detectChanges();
  });

  it('initializes and loads production orders, BOMs, MRP runs, and work centers', () => {
    expect(component).toBeTruthy();
    expect(component.orders().length).toBe(1);
    expect(component.boms().length).toBe(1);
    expect(component.mrpRuns().length).toBe(1);
    expect(component.plannedOrders().length).toBe(1);
    expect(component.shortages().length).toBe(1);
    expect(component.workCenters().length).toBe(1);
    expect(component.kpiTotalOrders()).toBe(1);
  });

  it('submits a new production order form', () => {
    component.openCreateOrderModal();
    expect(component.isCreateOrderModalVisible()).toBe(true);

    component.orderForm.patchValue({
      mfg_item_id: 'item-uuid-1',
      target_quantity: 25,
      planned_start_date: new Date('2026-05-01'),
      planned_end_date: new Date('2026-05-10'),
      notes: 'Test order notes',
    });

    component.submitCreateOrder();
    expect(apiService.createProductionOrder).toHaveBeenCalled();
    expect(component.isCreateOrderModalVisible()).toBe(false);
  });

  it('releases, starts, completes and closes production orders', () => {
    component.releaseOrder(mockOrder);
    expect(apiService.releaseProductionOrder).toHaveBeenCalledWith('po-1');

    component.startOrder(mockOrder);
    expect(apiService.startProductionOrder).toHaveBeenCalledWith('po-1');

    component.completeOrder(mockOrder);
    expect(apiService.completeProductionOrder).toHaveBeenCalledWith('po-1');

    component.closeOrder(mockOrder);
    expect(apiService.closeProductionOrder).toHaveBeenCalledWith('po-1');
  });

  it('creates and activates a BOM', () => {
    component.openCreateBomModal();
    expect(component.isCreateBomModalVisible()).toBe(true);

    component.bomForm.patchValue({
      mfg_item_id: 'item-uuid-2',
      bom_number: 'BOM-2026-01',
      name: 'Nuova Distinta Test',
      revision: 'A',
      base_quantity: 1,
      uom: 'PZ',
    });
    component.bomComponentsFormArray.at(0).patchValue({
      component_item_id: 'comp-uuid-1',
      quantity_per: 2,
    });

    component.submitCreateBom();
    expect(apiService.createBom).toHaveBeenCalled();
    expect(component.isCreateBomModalVisible()).toBe(false);

    component.activateBom(mockBom);
    expect(apiService.activateBom).toHaveBeenCalledWith('bom-1');
  });

  it('runs MRP and converts planned order into production order', () => {
    component.openRunMrpModal();
    expect(component.isRunMrpModalVisible()).toBe(true);

    component.mrpForm.patchValue({
      horizon_start_date: new Date('2026-04-01'),
      horizon_end_date: new Date('2026-06-30'),
      run_type: 'regenerative',
    });

    component.submitRunMrp();
    expect(apiService.runMrp).toHaveBeenCalled();
    expect(component.isRunMrpModalVisible()).toBe(false);

    component.convertPlannedOrder(mockPlannedOrder);
    expect(apiService.convertPlannedOrder).toHaveBeenCalledWith('plan-1');
  });

  it('creates a work center', () => {
    component.openCreateWorkCenterModal();
    expect(component.isCreateWorkCenterModalVisible()).toBe(true);

    component.workCenterForm.patchValue({
      work_center_code: 'WC-02',
      name: 'Reparto Saldatura',
      capacity_hours_per_day: 16,
      hourly_cost_rate: 65,
    });

    component.submitCreateWorkCenter();
    expect(apiService.createWorkCenter).toHaveBeenCalled();
    expect(component.isCreateWorkCenterModalVisible()).toBe(false);
  });
});
