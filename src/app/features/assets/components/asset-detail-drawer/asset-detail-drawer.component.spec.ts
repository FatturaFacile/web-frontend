import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import {
  AssetApiService,
  AssetBookResource,
  DepreciationScheduleResource,
  EamOpsApiService,
  FixedAssetResource,
  MaintenanceWorkOrderResource,
} from '@core';
import { AssetDetailDrawerComponent } from './asset-detail-drawer.component';

describe('AssetDetailDrawerComponent', () => {
  let fixture: ComponentFixture<AssetDetailDrawerComponent>;
  let component: AssetDetailDrawerComponent;

  const mockAsset: FixedAssetResource = {
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
    status: 'in_service',
    condition: 'excellent',
    acquisition_type: 'purchase',
    acquisition_date: '2026-01-10',
    capitalization_date: '2026-01-15',
    commissioning_date: '2026-01-20',
    in_service_date: '2026-01-20',
    depreciation_start_date: '2026-02-01',
    retirement_date: null,
    disposal_date: null,
    currency: 'CHF',
    acquisition_cost: '95000.00',
    capitalized_cost: '95000.00',
    salvage_value: '5000.00',
    depreciable_base: '90000.00',
    accumulated_depreciation: '7500.00',
    carrying_amount: '87500.00',
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
  };

  const mockBooks: AssetBookResource[] = [
    {
      id: 'book-1',
      asset_id: 'asset-1',
      ledger_type: 'statutory',
      depreciation_method: 'straight_line',
      useful_life_months: 120,
      rate_percent: '10.00',
      cost: '95000.00',
      salvage_value: '5000.00',
      depreciable_base: '90000.00',
      accumulated_depreciation: '7500.00',
      net_book_value: '87500.00',
      is_fully_depreciated: false,
      posts_to_gl: true,
    },
    {
      id: 'book-2',
      asset_id: 'asset-1',
      ledger_type: 'tax',
      depreciation_method: 'declining_balance',
      useful_life_months: 96,
      rate_percent: '20.00',
      cost: '95000.00',
      salvage_value: '0.00',
      depreciable_base: '95000.00',
      accumulated_depreciation: '19000.00',
      net_book_value: '76000.00',
      is_fully_depreciated: false,
      posts_to_gl: false,
    },
  ];

  const mockSchedules: DepreciationScheduleResource[] = [
    {
      id: 'sch-1',
      asset_id: 'asset-1',
      run_id: 'run-1',
      ledger_type: 'statutory',
      period_code: '2026-01',
      depreciation_method: 'straight_line',
      opening_book_value: '95000.00',
      depreciation_amount: '750.00',
      closing_book_value: '94250.00',
      accumulated_depreciation: '750.00',
      status: 'posted',
      posted_at: '2026-01-31',
    },
  ];

  const mockWorkOrders: MaintenanceWorkOrderResource[] = [
    {
      id: 'wo-1',
      work_order_number: 'WO-2026-01',
      asset_id: 'asset-1',
      maintenance_type: 'preventive',
      priority: 'medium',
      status: 'completed',
      scheduled_date: '2026-06-01',
      started_at: '2026-06-01',
      completed_at: '2026-06-01',
      total_cost: '350.00',
      problem_description: 'Annual calibration and spindle lubrication',
      resolution_notes: 'All checks passed',
    },
  ];

  const mockAssetApi = {
    getAssetBooks: vi.fn().mockReturnValue(of({ success: true, data: mockBooks })),
    getDepreciationSchedules: vi.fn().mockReturnValue(of({ success: true, data: mockSchedules, meta: { total: mockSchedules.length } })),
    getMaintenanceWorkOrders: vi.fn().mockReturnValue(of({ success: true, data: mockWorkOrders, meta: { total: mockWorkOrders.length } })),
    getParallelSchedules: vi.fn().mockReturnValue(of({ success: true, data: { asset_id: 'asset-1', asset_number: 'AST-001', fiscal_jurisdiction: 'CH', period_type: 'yearly', books: { statutory: {}, tax: {} }, incentive: {}, rows: [], totals: { civil_depreciation: '0.00', fiscal_depreciation: '0.00', temporary_difference: '0.00', incentive_tax_credit: '0.00', incentive_extra_deduction: '0.00' } } })),
    getFiscalRates: vi.fn().mockReturnValue(of({ success: true, data: [] })),
    configureBook: vi.fn().mockReturnValue(of({ success: true, data: mockBooks[1] })),
    previewDisposal: vi.fn().mockReturnValue(of({ success: true, data: { asset_id: 'asset-1', asset_number: 'AST-001', disposal_type: 'sale', disposed_percentage: '100', disposal_document_number: null, proceeds_amount: '95000.00', disposal_costs: '0.00', net_proceeds: '95000.00', civil: { cost_at_disposal: '95000.00', accumulated_depreciation: '7500.00', carrying_amount: '87500.00', gain_loss_amount: '7500.00', is_gain: true, is_loss: false }, fiscal: { cost_at_disposal: '95000.00', accumulated_depreciation: '19000.00', carrying_amount: '76000.00', gain_loss_amount: '19000.00', is_gain: true, is_loss: false, temporary_difference: '11500.00' }, proposed_gl_lines: [] } })),
    disposeAsset: vi.fn().mockReturnValue(of({ success: true, data: mockAsset })),
  };

  const mockOpsApi = {
    getAssetHistory: vi.fn().mockReturnValue(of({ success: true, data: { transfers: [], valuations: [], improvements: [], disposals: [] } })),
    recordImprovement: vi.fn().mockReturnValue(of({ success: true, data: { id: 'imp-1' } })),
    valuateAsset: vi.fn().mockReturnValue(of({ success: true, data: { id: 'val-1' } })),
    reverseImpairment: vi.fn().mockReturnValue(of({ success: true, data: { id: 'val-2' } })),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AssetDetailDrawerComponent],
      providers: [
        provideNzIcons(icons),
        { provide: AssetApiService, useValue: mockAssetApi },
        { provide: EamOpsApiService, useValue: mockOpsApi },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('asset', mockAsset);
    fixture.componentRef.setInput('visible', true);
  });

  it('loads parallel books, depreciation schedules, and maintenance orders of the asset', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(component).toBeTruthy();
    expect(mockAssetApi.getAssetBooks).toHaveBeenCalledWith('asset-1');
    expect(mockAssetApi.getDepreciationSchedules).toHaveBeenCalledWith('asset-1', expect.objectContaining({ page: 1 }));
    expect(mockAssetApi.getMaintenanceWorkOrders).toHaveBeenCalledWith(expect.objectContaining({ asset_id: 'asset-1' }));
    expect(component.books()).toEqual(mockBooks);
    expect(component.schedulesGrid.items()).toEqual(mockSchedules);
    expect(component.workOrdersGrid.items()).toEqual(mockWorkOrders);
  });

  it('returns appropriate color for parallel book ledger types', () => {
    expect(component.getLedgerTypeColor('statutory')).toBe('blue');
    expect(component.getLedgerTypeColor('tax')).toBe('orange');
    expect(component.getLedgerTypeColor('internal')).toBe('purple');
  });

  it('supports configuring parallel books, recording capital improvements, and previewing disposal gain/loss', () => {
    fixture.detectChanges();
    component.openConfigureBookModal(mockBooks[1]);
    component.bookForm.patchValue({ fiscal_regime: 'ch_afc_degressive', rate_percent: 40 });
    component.submitConfigureBook();
    expect(mockAssetApi.configureBook).toHaveBeenCalledWith(
      'asset-1',
      'tax',
      expect.objectContaining({ fiscal_regime: 'ch_afc_degressive', rate_percent: 40 }),
    );

    component.openImprovementModal();
    component.improvementForm.patchValue({ description: 'Spindle upgrade', amount: 3000 });
    component.submitImprovement();
    expect(mockOpsApi.recordImprovement).toHaveBeenCalledWith(
      'asset-1',
      expect.objectContaining({ description: 'Spindle upgrade', amount: 3000 }),
    );

    component.openDisposalModal();
    expect(mockAssetApi.previewDisposal).toHaveBeenCalled();
    expect(component.disposalPreview()?.fiscal.gain_loss_amount).toBe('19000.00');
  });
});
