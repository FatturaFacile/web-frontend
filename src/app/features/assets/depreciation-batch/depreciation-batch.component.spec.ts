import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { AssetApiService, AuthStore, EamOpsApiService } from '@core';
import { DepreciationBatchComponent } from './depreciation-batch.component';

describe('DepreciationBatchComponent', () => {
  let fixture: ComponentFixture<DepreciationBatchComponent>;
  let component: DepreciationBatchComponent;

  const mockAssetApi = {
    simulateDepreciation: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { entries: [{ asset_number: 'AST-2026-00001', depreciation_method: 'straight_line', depreciation_amount: 1000, closing_book_value: 9000 }] },
      }),
    ),
    executeYearEndBatch: vi.fn().mockReturnValue(
      of({
        success: true,
        data: {
          year: 2026,
          statutory_run: { id: 'run-civ', run_number: 'DEP-2026-001', period_code: '2026', period_type: 'yearly', ledger_type: 'statutory', assets_processed_count: 1, total_depreciation_amount: '1000.00', status: 'posted', executed_at: '2026-12-31', posted_at: '2026-12-31' },
          tax_run: { id: 'run-tax', run_number: 'DEP-2026-002', period_code: '2026', period_type: 'yearly', ledger_type: 'tax', assets_processed_count: 1, total_depreciation_amount: '2000.00', status: 'completed', executed_at: '2026-12-31', posted_at: null },
          civil_total: '1000.00',
          fiscal_total: '2000.00',
          temporary_difference: '1000.00',
          journal_entry_ids: ['je-1'],
        },
      }),
    ),
    postDepreciationRunToGl: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { id: 'run-1', run_number: 'DEP-2026-000', period_code: '2026', period_type: 'yearly', ledger_type: 'statutory', assets_processed_count: 1, total_depreciation_amount: '500.00', status: 'posted', executed_at: '2026-12-31', posted_at: '2026-12-31' },
      }),
    ),
  };

  const mockOpsApi = {
    getDepreciationRuns: vi.fn().mockReturnValue(
      of({
        success: true,
        data: [
          { id: 'run-1', run_number: 'DEP-2026-000', period_code: '2026', period_type: 'yearly', ledger_type: 'statutory', assets_processed_count: 1, total_depreciation_amount: '500.00', status: 'completed', executed_at: '2026-12-31', posted_at: null },
        ],
        meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
      }),
    ),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [DepreciationBatchComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AssetApiService, useValue: mockAssetApi },
        { provide: EamOpsApiService, useValue: mockOpsApi },
        { provide: AuthStore, useValue: { activeCurrency: () => 'CHF' } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DepreciationBatchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads depreciation run history and simulates year-end depreciation', () => {
    expect(mockOpsApi.getDepreciationRuns).toHaveBeenCalled();
    component.fiscalYear.set(2026);
    component.simulateYearEnd();
    expect(mockAssetApi.simulateDepreciation).toHaveBeenCalledWith(expect.objectContaining({ period_code: '2026', period_type: 'yearly' }));
    expect(component.simulationRows()).toHaveLength(1);
  });

  it('executes year-end batch and posts an unposted statutory run to GL', () => {
    component.fiscalYear.set(2026);
    component.executeBatch();
    expect(mockAssetApi.executeYearEndBatch).toHaveBeenCalledWith({ year: 2026, auto_post_to_gl: true });
    expect(component.lastBatchResult()?.tax_run?.id).toBe('run-tax');

    component.postRunToGl(component.runs()[0]);
    expect(mockAssetApi.postDepreciationRunToGl).toHaveBeenCalledWith('run-1');
  });
});
