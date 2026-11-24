import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { AuthStore, EamOpsApiService } from '@core';
import { AssetRegisterComponent } from './asset-register.component';

describe('AssetRegisterComponent', () => {
  let fixture: ComponentFixture<AssetRegisterComponent>;
  let component: AssetRegisterComponent;

  const mockOpsApi = {
    getAssetRegister: vi.fn().mockReturnValue(
      of({
        success: true,
        data: [
          {
            asset_id: 'a1',
            asset_number: 'AST-2026-00001',
            name: 'Precision Lathe',
            category_code: 'MACH',
            fiscal_jurisdiction: 'CH',
            acquisition_date: '2026-01-10',
            in_service_date: '2026-01-15',
            depreciation_method: 'declining_balance',
            rate_percent: '40.00',
            cost_start: '0.00',
            additions: '10000.00',
            improvements_year: '1500.00',
            disposals_cost: '0.00',
            cost_end: '11500.00',
            accumulated_start: '0.00',
            depreciation_year: '4600.00',
            disposals_accumulated: '0.00',
            accumulated_end: '4600.00',
            value_adjustments: '0.00',
            net_book_value_end: '6900.00',
          },
        ],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 200,
          total: 1,
          year: 2026,
          ledger_type: 'tax',
          compliance_header: {
            company_name: 'Helvetia Tech AG',
            legal_name: 'Helvetia Tech AG',
            tax_id: 'CHE-123.456.789',
            fiscal_code: '',
            jurisdiction: 'CH',
            legal_reference: 'Art. 958c / Art. 960a CO (OR) — Anlagebuchhaltung',
            currency: 'CHF',
            year: 2026,
            ledger_type: 'tax',
            generated_at: '2026-12-31T00:00:00Z',
          },
          category_subtotals: [
            {
              category_code: 'MACH',
              category_name: 'Machinery',
              assets_count: 1,
              cost_start: '0.00',
              additions: '10000.00',
              improvements_year: '1500.00',
              disposals_cost: '0.00',
              cost_end: '11500.00',
              accumulated_start: '0.00',
              depreciation_year: '4600.00',
              disposals_accumulated: '0.00',
              accumulated_end: '4600.00',
              value_adjustments: '0.00',
              net_book_value_end: '6900.00',
            },
          ],
          totals: {
            cost_start: '0.00',
            additions: '10000.00',
            improvements_year: '1500.00',
            disposals_cost: '0.00',
            cost_end: '11500.00',
            accumulated_start: '0.00',
            depreciation_year: '4600.00',
            disposals_accumulated: '0.00',
            accumulated_end: '4600.00',
            value_adjustments: '0.00',
            net_book_value_end: '6900.00',
          },
        },
      }),
    ),
    exportAssetRegister: vi.fn().mockReturnValue(of(new Blob(['csv'], { type: 'text/csv' }))),
    exportAssetRegisterPdf: vi.fn().mockReturnValue(of(new Blob(['pdf'], { type: 'application/pdf' }))),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AssetRegisterComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: EamOpsApiService, useValue: mockOpsApi },
        { provide: AuthStore, useValue: { activeCurrency: () => 'CHF' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads register rows, compliance header, category subtotals, and totals', () => {
    expect(mockOpsApi.getAssetRegister).toHaveBeenCalled();
    expect(component.rows()).toHaveLength(1);
    expect(component.complianceHeader()?.legal_reference).toContain('Art. 958c');
    expect(component.categorySubtotals()).toHaveLength(1);
    expect(component.totals()?.net_book_value_end).toBe('6900.00');
  });

  it('exports official register as CSV and PDF', () => {
    component.downloadCsv();
    component.downloadPdf();
    expect(mockOpsApi.exportAssetRegister).toHaveBeenCalled();
    expect(mockOpsApi.exportAssetRegisterPdf).toHaveBeenCalled();
  });
});
