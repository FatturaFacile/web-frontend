import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AssetApiService,
  AssetCategoryResource,
  AssetTagData,
  AuthStore,
  EamOpsApiService,
  FixedAssetResource,
} from '@core';
import { AssetsComponent } from './assets.component';

describe('AssetsComponent', () => {
  let fixture: ComponentFixture<AssetsComponent>;
  let component: AssetsComponent;

  const mockCategories: AssetCategoryResource[] = [
    {
      id: 'cat-1',
      parent_id: null,
      code: 'MACH',
      name: 'Machinery & Equipment',
      asset_type: 'tangible',
      depreciation_method: 'straight_line',
      useful_life_years: 10,
      statutory_rate_percent: '10.00',
    },
  ];

  const mockAssets: FixedAssetResource[] = [
    {
      id: 'asset-1',
      asset_number: 'AST-001',
      barcode_tag: 'BC-001',
      serial_number: 'SN-001',
      name: 'CNC Milling Center',
      description: 'Precision machining equipment',
      category_id: 'cat-1',
      asset_class_id: null,
      location_id: null,
      parent_asset_id: null,
      custodian_user_id: null,
      project_id: null,
      cost_center_id: null,
      supplier_id: null,
      status: 'acquired',
      condition: 'new',
      acquisition_type: 'purchase',
      acquisition_date: '2026-01-10',
      capitalization_date: null,
      commissioning_date: null,
      in_service_date: null,
      depreciation_start_date: null,
      retirement_date: null,
      disposal_date: null,
      currency: 'CHF',
      acquisition_cost: '95000.00',
      capitalized_cost: null,
      salvage_value: '5000.00',
      depreciable_base: '90000.00',
      accumulated_depreciation: '0.00',
      carrying_amount: '95000.00',
      replacement_cost: null,
      depreciation_method: 'straight_line',
      useful_life_years: 10,
      useful_life_months: 120,
      depreciation_rate_percent: '10.00',
      is_depreciable: true,
      is_fully_depreciated: false,
      approval_status: 'approved',
      is_locked: false,
      created_at: '2026-01-10',
      updated_at: '2026-01-10',
    },
  ];

  const mockTag: AssetTagData = {
    asset_id: 'asset-1',
    asset_number: 'AST-001',
    barcode_value: 'AST001',
    barcode_symbology: 'code128',
    qr_payload: 'https://fatturafacile.eu/eam/assets/asset-1',
    label_lines: [],
  };

  const mockAssetApi = {
    getCategories: vi.fn().mockReturnValue(of({ success: true, data: mockCategories })),
    getAssets: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockAssets,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createAsset: vi.fn().mockReturnValue(of({ success: true, data: mockAssets[0] })),
    capitalizeAsset: vi.fn().mockReturnValue(of({ success: true, data: { ...mockAssets[0], status: 'capitalized' } })),
    commissionAsset: vi.fn().mockReturnValue(of({ success: true, data: { ...mockAssets[0], status: 'in_service' } })),
    getAssetTag: vi.fn().mockReturnValue(of({ success: true, data: mockTag })),
    getAssetBooks: vi.fn().mockReturnValue(of({ success: true, data: [] })),
    getDepreciationSchedules: vi.fn().mockReturnValue(of({ success: true, data: [] })),
    getMaintenanceWorkOrders: vi.fn().mockReturnValue(of({ success: true, data: [] })),
    getFiscalRates: vi.fn().mockReturnValue(
      of({
        success: true,
        data: [
          {
            id: 'rate-ch-1',
            jurisdiction: 'CH',
            regime_code: 'CH_AFC_1995',
            category_code: 'MACH',
            category_name: 'Maschinen',
            declining_rate_percent: '30.00',
            linear_rate_percent: '15.00',
            useful_life_years: 7,
            first_year_half_rule: false,
            legal_reference: 'ESTV Merkblatt A 1995',
            is_active: true,
          },
        ],
      }),
    ),
  };

  const mockOpsApi = {
    getLocations: vi.fn().mockReturnValue(of({ success: true, data: [] })),
    getPendingInvoiceLines: vi.fn().mockReturnValue(
      of({
        success: true,
        data: [
          {
            id: 'line-1',
            passive_invoice_id: 'inv-1',
            invoice_number: 'FT-2026-001',
            invoice_date: '2026-02-01',
            supplier_id: null,
            supplier_name: 'Swiss Machines AG',
            description: 'CNC Spindle Assembly',
            line_total: '12000.00',
            currency: 'CHF',
            is_capital_asset: true,
            asset_category_id: 'cat-1',
          },
        ],
        meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
      }),
    ),
    acquireAsset: vi.fn().mockReturnValue(of({ success: true, data: mockAssets[0] })),
  };

  const mockMessage = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };

  const mockAuthStore = {
    activeCurrency: vi.fn().mockReturnValue('CHF'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AssetsComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AssetApiService, useValue: mockAssetApi },
        { provide: EamOpsApiService, useValue: mockOpsApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetsComponent);
    component = fixture.componentInstance;
  });

  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 400));

  it('loads categories and assets list on initialization', async () => {
    fixture.detectChanges();
    await settle();
    expect(component).toBeTruthy();
    expect(mockAssetApi.getCategories).toHaveBeenCalled();
    expect(mockAssetApi.getAssets).toHaveBeenCalled();
    expect(component.grid.items()).toEqual(mockAssets);
    expect(component.grid.totalCount()).toBe(1);
  });

  it('filters assets by search query on the server', async () => {
    fixture.detectChanges();
    await settle();
    const event = { target: { value: 'Milling' } } as unknown as Event;
    component.onSearch(event);
    await settle();

    expect(component.searchTerm()).toBe('Milling');
    expect(mockAssetApi.getAssets).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Milling', page: 1 }),
    );
  });

  it('sends the server key of the calculated carrying value column', async () => {
    fixture.detectChanges();
    await settle();
    component.grid.onGridParams({ pageIndex: 1, pageSize: 10, sort: { key: 'carrying_value', order: 'descend' }, filters: {} });
    await settle();

    expect(mockAssetApi.getAssets).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort_by: 'carrying_value', sort_dir: 'desc' }),
    );
  });

  it('submits create asset modal form', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.assetForm.patchValue({
      name: 'Laser Welder',
      category_id: 'cat-1',
      acquisition_cost: 45000,
      useful_life_years: 8,
      condition: 'new',
    });

    component.submitCreateAsset();

    expect(mockAssetApi.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Laser Welder',
        category_id: 'cat-1',
        acquisition_cost: 45000,
        currency: 'CHF',
      }),
    );
    expect(mockMessage.success).toHaveBeenCalledWith('assets.msgFixedAssetRecorded');
    expect(component.createModalVisible()).toBe(false);
  });

  it('does not call the API when the create asset form is submitted empty', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.assetForm.patchValue({ name: '', category_id: '' });

    component.submitCreateAsset();

    expect(mockAssetApi.createAsset).not.toHaveBeenCalled();
    expect(component.assetForm.controls.name.touched).toBe(true);
    expect(component.assetForm.controls.category_id.touched).toBe(true);
  });

  it('capitalizes and commissions asset', () => {
    fixture.detectChanges();
    component.capitalize(mockAssets[0]);
    expect(mockAssetApi.capitalizeAsset).toHaveBeenCalledWith('asset-1');

    component.commission(mockAssets[0]);
    expect(mockAssetApi.commissionAsset).toHaveBeenCalledWith('asset-1');
  });

  it('loads tag and opens QR modal', () => {
    fixture.detectChanges();
    component.viewQrCode(mockAssets[0]);

    expect(mockAssetApi.getAssetTag).toHaveBeenCalledWith('asset-1');
    expect(component.qrModalVisible()).toBe(true);
    expect(component.getQrString()).toBe('https://fatturafacile.eu/eam/assets/asset-1');
  });

  it('auto-populates useful life and method when picking a fiscal rate preset and acquires pending vendor invoice lines', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.onCreateFiscalRateSelected('rate-ch-1');
    expect(component.assetForm.controls.useful_life_years.value).toBe(7);
    expect(component.assetForm.controls.depreciation_method.value).toBe('declining_balance');

    component.openAcquireModal();
    expect(mockOpsApi.getPendingInvoiceLines).toHaveBeenCalledWith(expect.objectContaining({ only_capital: true }));
    component.selectInvoiceLine(component.pendingInvoiceLines()[0]);
    component.submitAcquireFromInvoiceLine();
    expect(mockOpsApi.acquireAsset).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'passive_invoice_line', source_id: 'line-1', category_id: 'cat-1' }),
    );
  });
});
