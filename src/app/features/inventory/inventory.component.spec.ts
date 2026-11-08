import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AuthStore,
  I18nService,
  InventoryAdjustmentItem,
  InventoryApiService,
  InventoryCountSessionItem,
  ProductItem,
  StockLevelItem,
  StockMovementItem,
  StockValuationSummary,
  TranslateService,
  WarehouseItem,
} from '@core';
import { InventoryComponent } from './inventory.component';

describe('InventoryComponent', () => {
  let fixture: ComponentFixture<InventoryComponent>;
  let component: InventoryComponent;

  const mockProducts: ProductItem[] = [
    {
      id: 'prod-1',
      sku: 'SKU-001',
      name: 'Widget A',
      warehouse: 'Milano (IT)',
      quantity: 50,
      unit_of_measure: 'Pz',
      price: 19.99,
      currency: 'EUR',
      hs_code: '84713000',
    },
  ];

  const mockWarehouses: WarehouseItem[] = [
    {
      id: 'wh-1',
      code: 'WH-MI',
      name: 'Milano Hub',
      type: 'standard',
    },
  ];

  const mockStockLevels: StockLevelItem[] = [
    {
      product_id: 'prod-1',
      sku: 'SKU-001',
      name: 'Widget A',
      quantity: 50,
      on_hand: 50,
      reserved: 10,
      available: 40,
      shortfall: 0,
    },
  ];

  const mockMovements: StockMovementItem[] = [
    {
      id: 'mov-1',
      movement_number: 'MOV-001',
      warehouse_id: 'wh-1',
      movement_type: 'INTERNAL_TRANSFER',
      quantity: 10,
      signed_quantity: 10,
      unit_cost: 15,
      total_valuation: 150,
    },
  ];

  const mockAdjustments: InventoryAdjustmentItem[] = [
    {
      id: 'adj-1',
      warehouse_id: 'wh-1',
      adjustment_number: 'ADJ-001',
      reason: 'cycle_count_variance',
      status: 'pending_approval',
      net_valuation_change: -30,
    },
  ];

  const mockCounts: InventoryCountSessionItem[] = [
    {
      id: 'cnt-1',
      session_number: 'CNT-001',
      warehouse_id: 'wh-1',
      count_type: 'full_physical',
      status: 'scheduled',
      scheduled_date: '2026-11-10',
    },
  ];

  const mockValuation: StockValuationSummary = {
    valuation_method: 'FIFO',
    warehouse_id: 'wh-1',
    total_valuation: 7500,
    items_count: 1,
    items: [
      {
        item_id: 'prod-1',
        sku: 'SKU-001',
        name: 'Widget A',
        valuation: 7500,
      },
    ],
  };

  const mockInventoryApi = {
    getProducts: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockProducts,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createProduct: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockProducts[0],
      }),
    ),
    deleteProduct: vi.fn().mockReturnValue(
      of({
        success: true,
        data: null,
      }),
    ),
    getWarehouses: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockWarehouses,
      }),
    ),
    getStockLevels: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockStockLevels,
      }),
    ),
    getMovements: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockMovements,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    transferStock: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockMovements[0],
      }),
    ),
    getAdjustments: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockAdjustments,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createAdjustment: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockAdjustments[0],
      }),
    ),
    approveAdjustment: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockAdjustments[0], status: 'approved' },
      }),
    ),
    rejectAdjustment: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockAdjustments[0], status: 'rejected' },
      }),
    ),
    getCounts: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockCounts,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createCount: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockCounts[0],
      }),
    ),
    reconcileCount: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockCounts[0], status: 'reconciled' },
      }),
    ),
    getValuationSummary: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockValuation,
      }),
    ),
    captureValuationSnapshot: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { snapshot_id: 'snap-1' },
      }),
    ),
  };

  const mockTranslate = {
    instant: vi.fn((k: string) => k),
    translate: vi.fn((k: string) => k),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  const mockAuthStore = {
    activeJurisdiction: vi.fn().mockReturnValue('IT'),
    activeCurrency: vi.fn().mockReturnValue('EUR'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [InventoryComponent],
      providers: [
        provideNzIcons(icons),
        { provide: InventoryApiService, useValue: mockInventoryApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryComponent);
    component = fixture.componentInstance;
  });

  it('loads products, warehouses, and stock levels on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockInventoryApi.getWarehouses).toHaveBeenCalled();
    expect(mockInventoryApi.getProducts).toHaveBeenCalled();
    expect(mockInventoryApi.getStockLevels).toHaveBeenCalled();
    expect(component.stockLevels()).toEqual(mockStockLevels);
    expect(component.totalOnHand()).toBe(50);
    expect(component.totalAvailable()).toBe(40);
    expect(component.totalReserved()).toBe(10);
    expect(component.totalShortfall()).toBe(0);
  });

  it('filters stock levels by warehouse', () => {
    fixture.detectChanges();
    component.onWarehouseFilterChange('wh-1');
    expect(component.selectedWarehouseFilter()).toBe('wh-1');
    expect(mockInventoryApi.getStockLevels).toHaveBeenCalledWith('wh-1');
  });

  it('loads movements and handles transfer submission', () => {
    fixture.detectChanges();
    component.onTabChange(1);
    expect(component.selectedTabIndex()).toBe(1);
    expect(mockInventoryApi.getMovements).toHaveBeenCalled();
    expect(component.movements().length).toBe(1);

    component.openTransferModal();
    expect(component.transferModalVisible()).toBe(true);

    component.transferForm.patchValue({
      stock_item_id: 'prod-1',
      warehouse_id: 'wh-1',
      quantity: 5,
      movement_type: 'INTERNAL_TRANSFER',
      unit_cost: 12,
    });

    component.submitTransfer();
    expect(mockInventoryApi.transferStock).toHaveBeenCalledWith({
      stock_item_id: 'prod-1',
      warehouse_id: 'wh-1',
      quantity: 5,
      movement_type: 'INTERNAL_TRANSFER',
      unit_cost: 12,
      source_bin_id: undefined,
      destination_bin_id: undefined,
      notes: undefined,
    });
    expect(component.transferModalVisible()).toBe(false);
  });

  it('loads adjustments, approves and creates new adjustment', () => {
    fixture.detectChanges();
    component.onTabChange(2);
    expect(mockInventoryApi.getAdjustments).toHaveBeenCalled();
    expect(component.adjustments().length).toBe(1);

    component.approveAdjustment('adj-1');
    expect(mockInventoryApi.approveAdjustment).toHaveBeenCalledWith('adj-1');

    component.openAdjustmentModal();
    expect(component.adjustmentModalVisible()).toBe(true);

    component.adjustmentForm.patchValue({
      warehouse_id: 'wh-1',
      reason: 'scrap',
      stock_item_id: 'prod-1',
      quantity_delta: -3,
      unit_cost: 15,
    });

    component.submitAdjustment();
    expect(mockInventoryApi.createAdjustment).toHaveBeenCalledWith({
      warehouse_id: 'wh-1',
      reason: 'scrap',
      notes: undefined,
      lines: [
        {
          stock_item_id: 'prod-1',
          quantity_delta: -3,
          unit_cost: 15,
        },
      ],
    });
    expect(component.adjustmentModalVisible()).toBe(false);
  });

  it('loads count sessions, reconciles and schedules new count', () => {
    fixture.detectChanges();
    component.onTabChange(3);
    expect(mockInventoryApi.getCounts).toHaveBeenCalled();
    expect(component.counts().length).toBe(1);

    component.reconcileCount('cnt-1');
    expect(mockInventoryApi.reconcileCount).toHaveBeenCalledWith('cnt-1');

    component.openCountModal();
    expect(component.countModalVisible()).toBe(true);

    component.countForm.patchValue({
      warehouse_id: 'wh-1',
      count_type: 'cycle_count_abc',
      scheduled_date: '2026-11-20',
    });

    component.submitCount();
    expect(mockInventoryApi.createCount).toHaveBeenCalledWith({
      warehouse_id: 'wh-1',
      count_type: 'cycle_count_abc',
      scheduled_date: '2026-11-20',
      notes: undefined,
    });
    expect(component.countModalVisible()).toBe(false);
  });

  it('loads valuation and captures snapshot', () => {
    fixture.detectChanges();
    component.onTabChange(4);
    expect(mockInventoryApi.getValuationSummary).toHaveBeenCalled();
    expect(component.valuation()).toEqual(mockValuation);

    component.captureSnapshot();
    expect(mockInventoryApi.captureValuationSnapshot).toHaveBeenCalled();
  });

  it('filters products on search in catalog tab', () => {
    fixture.detectChanges();
    component.onTabChange(5);
    const event = { target: { value: 'Widget' } } as unknown as Event;
    component.onSearch(event);

    expect(component.searchTerm()).toBe('Widget');
    expect(component.pageIndex()).toBe(1);
    expect(mockInventoryApi.getProducts).toHaveBeenCalledWith({
      page: 1,
      per_page: 10,
      search: 'Widget',
    });
  });

  it('submits create product successfully', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.productForm.patchValue({
      sku: 'SKU-002',
      name: 'Widget B',
      warehouse: 'Milano (IT)',
      quantity: 10,
      unit_of_measure: 'Pz',
      price: 25.5,
    });

    component.submitCreateProduct();

    expect(mockInventoryApi.createProduct).toHaveBeenCalledWith({
      sku: 'SKU-002',
      name: 'Widget B',
      warehouse: 'Milano (IT)',
      quantity: 10,
      unit_of_measure: 'Pz',
      price: 25.5,
      currency: 'EUR',
      hs_code: undefined,
    });
    expect(mockMessage.success).toHaveBeenCalledWith('inventory.messages.created');
    expect(component.createModalVisible()).toBe(false);
  });

  it('deletes product and reloads list', () => {
    fixture.detectChanges();
    component.deleteProduct(mockProducts[0]);

    expect(mockInventoryApi.deleteProduct).toHaveBeenCalledWith('prod-1');
    expect(mockMessage.success).toHaveBeenCalledWith('inventory.messages.deleted');
  });
});
