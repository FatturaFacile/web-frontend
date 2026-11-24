import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, GeneralLedgerApiService, I18nService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { GlAccrualsComponent } from './gl-accruals.component';
import { GlLookupStore } from '../shared/gl-lookup.store';

describe('GlAccrualsComponent (Mod 022 Workbench)', () => {
  const sampleSummary = {
    fiscal_year: {
      id: 'fy-2026',
      year_code: '2026',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'open',
    },
    year_label: '2026',
    cutoff_date: '2026-12-31',
    reversal_date: '2027-01-01',
    currency: 'EUR',
    kpis: {
      prepaid_expense_total: '897.53',
      deferred_revenue_total: '0.00',
      accrued_revenue_total: '0.00',
      accrued_expense_total: '184.00',
      total_recognized: '483.47',
      total_transitory: '1081.53',
      pending_closing_count: 1,
      closing_posted_count: 1,
      pending_reversal_count: 1,
      reversal_posted_count: 0,
    },
    items: [
      {
        item_key: 'passive_invoice_line:line-1',
        accrual_id: null,
        accrual_type: 'prepaid_expense' as const,
        source_type: 'passive_invoice_line' as const,
        source_document_type: 'passive_invoice',
        source_document_id: 'pinv-1',
        source_line_id: 'line-1',
        source_document_number: 'FATT-101',
        document_date: '2026-10-01',
        description: 'Annual insurance policy',
        currency: 'EUR',
        competence_start_date: '2026-10-01',
        competence_end_date: '2027-09-30',
        cutoff_date: '2026-12-31',
        reversal_date: '2027-01-01',
        total_days: 365,
        period_days: 92,
        transitory_days: 273,
        total_amount: '1200.00',
        recognized_amount: '302.47',
        transitory_amount: '897.53',
        income_statement_account_id: 'acc-exp',
        income_statement_account_code: '6000',
        income_statement_account_name: 'Insurance',
        balance_sheet_account_id: 'acc-prepaid',
        balance_sheet_account_code: '1300',
        balance_sheet_account_name: 'Prepaid expenses',
        cost_center_id: null,
        status: 'calculated' as const,
        closing_journal_entry_id: null,
        closing_journal_entry_number: null,
        closing_journal_posting_date: null,
        closing_journal_status: null,
        reversal_journal_entry_id: null,
        reversal_journal_entry_number: null,
        reversal_journal_posting_date: null,
        yearly_schedule: [],
      },
      {
        item_key: 'manual:acc-1',
        accrual_id: 'acc-1',
        accrual_type: 'accrued_expense' as const,
        source_type: 'manual' as const,
        source_document_type: null,
        source_document_id: null,
        source_line_id: 'acc-1',
        source_document_number: null,
        document_date: '2026-12-31',
        description: 'Accrued loan interest',
        currency: 'EUR',
        competence_start_date: '2026-07-01',
        competence_end_date: '2027-06-30',
        cutoff_date: '2026-12-31',
        reversal_date: '2027-01-01',
        total_days: 365,
        period_days: 184,
        transitory_days: 184,
        total_amount: '365.00',
        recognized_amount: '184.00',
        transitory_amount: '184.00',
        income_statement_account_id: 'acc-int',
        income_statement_account_code: '6900',
        income_statement_account_name: 'Interest',
        balance_sheet_account_id: 'acc-accrued',
        balance_sheet_account_code: '2300',
        balance_sheet_account_name: 'Accrued liabilities',
        cost_center_id: null,
        status: 'closing_posted' as const,
        closing_journal_entry_id: 'je-3112',
        closing_journal_entry_number: 'JE-2026-0099',
        closing_journal_posting_date: '2026-12-31',
        closing_journal_status: 'posted',
        reversal_journal_entry_id: null,
        reversal_journal_entry_number: null,
        reversal_journal_posting_date: null,
        yearly_schedule: [],
      },
    ],
  };

  let api: {
    getFiscalYears: ReturnType<typeof vi.fn>;
    getAccrualsSummary: ReturnType<typeof vi.fn>;
    generateAccrualClosingEntries: ReturnType<typeof vi.fn>;
    generateAccrualReversals: ReturnType<typeof vi.fn>;
    exportAccrualsReconciliation: ReturnType<typeof vi.fn>;
    createAccrual: ReturnType<typeof vi.fn>;
    getJournal: ReturnType<typeof vi.fn>;
  };

  let message: {
    success: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      getFiscalYears: vi.fn().mockReturnValue(
        of({
          data: [{ id: 'fy-2026', year_code: '2026', start_date: '2026-01-01', end_date: '2026-12-31', status: 'open', is_locked: false, closed_at: null }],
        }),
      ),
      getAccrualsSummary: vi.fn().mockReturnValue(of({ success: true, message: '', data: sampleSummary })),
      generateAccrualClosingEntries: vi.fn().mockReturnValue(
        of({
          success: true,
          message: '',
          data: {
            cutoff_date: '2026-12-31',
            reversal_date: '2027-01-01',
            posted: [{ item_key: 'passive_invoice_line:line-1', accrual_id: 'acc-new', accrual_type: 'prepaid_expense', amount: '897.53', journal_entry_id: 'je-1', entry_number: 'JE-1', status: 'posted' }],
            skipped: [],
            failed: [],
            reversals: { reversed: [], skipped: [], failed: [] },
          },
        }),
      ),
      generateAccrualReversals: vi.fn().mockReturnValue(
        of({
          success: true,
          message: '',
          data: {
            reversed: [{ accrual_id: 'acc-1', closing_journal_entry_id: 'je-3112', reversal_journal_entry_id: 'je-0101', reversal_entry_number: 'REV-JE-2026-0099', reversal_date: '2027-01-01' }],
            skipped: [],
            failed: [],
          },
        }),
      ),
      exportAccrualsReconciliation: vi.fn().mockReturnValue(of(new Blob(['csv-data'], { type: 'text/csv' }))),
      createAccrual: vi.fn().mockReturnValue(of({ success: true, message: '', data: {} })),
      getJournal: vi.fn().mockReturnValue(of({ success: true, message: '', data: null })),
    };

    message = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [GlAccrualsComponent],
      providers: [
        provideNoopAnimations(),
        provideNzIcons(icons),
        { provide: GeneralLedgerApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (k: string) => k, currentLanguage: () => 'en' } },
        { provide: AuthStore, useValue: { activeCurrency: () => 'EUR' } },
        {
          provide: GlLookupStore,
          useValue: {
            load: vi.fn(),
            accounts: () => [],
            costCenters: () => [],
            accountLabel: (id: string) => id,
          },
        },
      ],
    });
  });

  it('loads fiscal years and summary schedule on init', async () => {
    const fixture = TestBed.createComponent(GlAccrualsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.getFiscalYears).toHaveBeenCalledTimes(1);
    expect(api.getAccrualsSummary).toHaveBeenCalledWith(expect.objectContaining({ fiscal_year_id: 'fy-2026' }));
    expect(fixture.nativeElement.textContent).toContain('Annual insurance policy');
    expect(fixture.nativeElement.textContent).toContain('Accrued loan interest');
  });

  it('triggers 1-click 31/12 closing entry generation and reloads summary', async () => {
    const fixture = TestBed.createComponent(GlAccrualsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance['runClosingEntries']();

    expect(api.generateAccrualClosingEntries).toHaveBeenCalledWith({
      fiscal_year_id: 'fy-2026',
      item_keys: [{ source_type: 'passive_invoice_line', source_line_id: 'line-1' }],
      auto_generate_reversals: false,
    });
    expect(message.success).toHaveBeenCalled();
    expect(api.getAccrualsSummary).toHaveBeenCalledTimes(2);
  });

  it('triggers 01/01 reversal generation and reloads summary', async () => {
    const fixture = TestBed.createComponent(GlAccrualsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance['runReversals']();

    expect(api.generateAccrualReversals).toHaveBeenCalledWith({
      fiscal_year_id: 'fy-2026',
      accrual_ids: ['acc-1'],
    });
    expect(message.success).toHaveBeenCalled();
  });

  it('requests reconciliation CSV export from API', async () => {
    const createObjectUrl = vi.fn().mockReturnValue('blob:mock');
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });

    const fixture = TestBed.createComponent(GlAccrualsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance['exportReconciliation']();

    expect(api.exportAccrualsReconciliation).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('requests the reconciliation worksheet as xlsx', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:mock'), revokeObjectURL: vi.fn() });

    const fixture = TestBed.createComponent(GlAccrualsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance['exportReconciliation']('xlsx');

    expect(api.exportAccrualsReconciliation).toHaveBeenCalledWith(expect.anything(), 'xlsx');
    vi.unstubAllGlobals();
  });

  it('computes real-time preview inside the manual accrual modal form', async () => {
    const fixture = TestBed.createComponent(GlAccrualsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance['form'].patchValue({
      accrual_type: 'prepaid_expense',
      description: 'Annual insurance',
      total_amount: 1200,
      coverage_start: '2026-10-01',
      coverage_end: '2027-09-30',
      cutoff_date: '2026-12-31',
    });

    const preview = fixture.componentInstance['manualPreview']();
    expect(preview).not.toBeNull();
    expect(preview!.transitoryDays).toBe(273);
    expect(preview!.transitoryAmount).toBe(897.53);
  });
});
