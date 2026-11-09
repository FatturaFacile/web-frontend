import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { of } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { AnalyticsComponent } from './analytics.component';
import {
  AnalyticsApiService,
  AnalyticsKpiReport,
  AnalyticsReportDefinition,
  BreakdownEntry,
  DueCalendarEntry,
  RevenueComparisonData,
} from '@core';

describe('AnalyticsComponent', () => {
  let component: AnalyticsComponent;
  let fixture: ComponentFixture<AnalyticsComponent>;
  let analyticsApiSpy: Mocked<AnalyticsApiService>;
  let messageSpy: Mocked<NzMessageService>;
  let modalSpy: Mocked<NzModalService>;

  const mockKpiReport: AnalyticsKpiReport = {
    period: { from: '2026-11-01', to: '2026-11-30' },
    comparison_period: { from: '2026-10-01', to: '2026-10-31' },
    kpis: [
      {
        key: 'sales',
        label: 'Net Sales',
        unit: 'currency',
        kind: 'period',
        available: true,
        value: '50000',
        change: '5000',
        change_percent: '11.1',
      },
      {
        key: 'margin',
        label: 'Gross Margin',
        unit: 'percent',
        kind: 'period',
        available: true,
        value: '38',
      },
      {
        key: 'hr-headcount',
        label: 'Headcount',
        unit: 'count',
        kind: 'snapshot',
        available: false,
        reason: 'forbidden',
      },
    ],
  };

  const mockDueEntries: DueCalendarEntry[] = [
    {
      id: 'due-1',
      date: '2026-11-10',
      direction: 'inflow',
      amount: 4000,
      currency: 'EUR',
      description: 'Invoice FT-101',
      is_overdue: false,
    },
    {
      id: 'due-2',
      date: '2026-11-05',
      direction: 'outflow',
      amount: 1500,
      currency: 'EUR',
      description: 'Supplier Invoice SP-201',
      is_overdue: true,
    },
  ];

  const mockRevenueComp: RevenueComparisonData = {
    year: 2026,
    months: [
      {
        month: 1,
        month_name: 'Jan',
        revenue: 20000,
        previous_year_revenue: 15000,
        variance: 5000,
        variance_percent: 33.3,
      },
    ],
    total_revenue: 20000,
    total_previous_revenue: 15000,
    overall_variance_percent: 33.3,
  };

  const mockBreakdown: BreakdownEntry[] = [
    { key: 'sw', label: 'Software', amount: 12000, percentage: 60 },
    { key: 'hw', label: 'Hardware', amount: 8000, percentage: 40 },
  ];

  const mockReportDefs: AnalyticsReportDefinition[] = [
    {
      id: 'rep-1',
      user_id: 'u-1',
      name: 'Monthly Overview',
      description: 'Overview description',
      kpis: ['sales', 'margin'],
      period_preset: 'last_month',
      compare: 'previous_period',
      is_shared: true,
      is_owner: true,
    },
  ];

  beforeEach(async () => {
    analyticsApiSpy = { getKpis: vi.fn(), exportKpisCsv: vi.fn(), getDueCalendar: vi.fn(), getRevenueComparison: vi.fn(), getBreakdown: vi.fn(), getReportDefinitions: vi.fn(), createReportDefinition: vi.fn(), updateReportDefinition: vi.fn(), deleteReportDefinition: vi.fn(), runReportDefinition: vi.fn(), exportReportDefinition: vi.fn(), getReportingFeed: vi.fn() } as unknown as Mocked<AnalyticsApiService>;

    analyticsApiSpy.getKpis.mockReturnValue(of({ success: true, message: '', data: mockKpiReport }));
    analyticsApiSpy.exportKpisCsv.mockReturnValue(of(new Blob(['csv'], { type: 'text/csv' })));
    analyticsApiSpy.getDueCalendar.mockReturnValue(of({ success: true, message: '', data: mockDueEntries }));
    analyticsApiSpy.getRevenueComparison.mockReturnValue(of({ success: true, message: '', data: mockRevenueComp }));
    analyticsApiSpy.getBreakdown.mockReturnValue(of({ success: true, message: '', data: mockBreakdown }));
    analyticsApiSpy.getReportDefinitions.mockReturnValue(of({ success: true, message: '', data: mockReportDefs }));
    analyticsApiSpy.createReportDefinition.mockReturnValue(of({ success: true, message: '', data: mockReportDefs[0] }));
    analyticsApiSpy.updateReportDefinition.mockReturnValue(of({ success: true, message: '', data: mockReportDefs[0] }));
    analyticsApiSpy.deleteReportDefinition.mockReturnValue(of({ success: true, message: '', data: undefined }));
    analyticsApiSpy.runReportDefinition.mockReturnValue(of({ success: true, message: '', data: mockKpiReport }));
    analyticsApiSpy.exportReportDefinition.mockReturnValue(of(new Blob(['csv'], { type: 'text/csv' })));
    analyticsApiSpy.getReportingFeed.mockReturnValue(of({ success: true, message: '', data: [{ id: 1, amount: 100 }] }));

    messageSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } as unknown as Mocked<NzMessageService>;
    modalSpy = { confirm: vi.fn() } as unknown as Mocked<NzModalService>;

    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent],
      providers: [
        { provide: AnalyticsApiService, useValue: analyticsApiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: NzModalService, useValue: modalSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load dashboard on init', () => {
    expect(component).toBeTruthy();
    expect(analyticsApiSpy.getKpis).toHaveBeenCalled();
    expect(analyticsApiSpy.getDueCalendar).toHaveBeenCalled();
    expect(analyticsApiSpy.getRevenueComparison).toHaveBeenCalled();
    expect(analyticsApiSpy.getBreakdown).toHaveBeenCalled();
    expect(analyticsApiSpy.getReportDefinitions).toHaveBeenCalled();
    expect(analyticsApiSpy.getReportingFeed).toHaveBeenCalled();
    expect(component.kpiReport()).toEqual(mockKpiReport);
  });

  it('should compute due calendar summary correctly', () => {
    const summary = component.dueCalendarSummary();
    expect(summary.totalInflow).toBe(4000);
    expect(summary.totalOutflow).toBe(1500);
    expect(summary.netLiquidity).toBe(2500);
    expect(summary.overdueCount).toBe(1);
  });

  it('should filter due calendar entries by direction and overdue_only', () => {
    component.filterDirection.set('inflow');
    expect(component.filteredDueEntries().length).toBe(1);
    expect(component.filteredDueEntries()[0].id).toBe('due-1');

    component.filterDirection.set('all');
    component.filterOverdueOnly.set(true);
    expect(component.filteredDueEntries().length).toBe(1);
    expect(component.filteredDueEntries()[0].id).toBe('due-2');
  });

  it('should change KPI period preset and reload KPIs', () => {
    component.onPeriodChange('year_to_date');
    expect(component.selectedPeriodPreset()).toBe('year_to_date');
    expect(analyticsApiSpy.getKpis).toHaveBeenCalledWith({
      period_preset: 'year_to_date',
      compare: 'previous_period',
    });
  });

  it('should change compare mode and reload KPIs', () => {
    component.onCompareChange('previous_year');
    expect(component.selectedCompare()).toBe('previous_year');
    expect(analyticsApiSpy.getKpis).toHaveBeenCalledWith({
      period_preset: 'month_to_date',
      compare: 'previous_year',
    });
  });

  it('should trigger KPI export CSV', () => {
    vi.spyOn(component as unknown as { downloadBlob: () => void }, 'downloadBlob').mockImplementation(() => undefined);
    component.exportKpisCsv();
    expect(analyticsApiSpy.exportKpisCsv).toHaveBeenCalled();
    expect(messageSpy.success).toHaveBeenCalledWith('KPI export completed');
  });

  it('should switch dimension and load breakdown', () => {
    component.onDimensionChange('region');
    expect(component.selectedDimension()).toBe('region');
    expect(analyticsApiSpy.getBreakdown).toHaveBeenCalledWith('region', 2026);
  });

  it('should handle custom report modal open, create, and edit', () => {
    // Open create
    component.openCreateReportModal();
    expect(component.isReportModalVisible()).toBe(true);
    expect(component.editingReportId()).toBeNull();

    // Fill form and save create
    component.reportForm.patchValue({
      name: 'Custom Pack',
      description: 'Desc',
      kpis: ['sales'],
      period_preset: 'last_30_days',
      compare: 'none',
      is_shared: false,
    });
    component.saveReportDefinition();
    expect(analyticsApiSpy.createReportDefinition).toHaveBeenCalled();
    expect(component.isReportModalVisible()).toBe(false);

    // Open edit
    component.openEditReportModal(mockReportDefs[0]);
    expect(component.isReportModalVisible()).toBe(true);
    expect(component.editingReportId()).toBe('rep-1');
    expect(component.reportForm.value.name).toBe('Monthly Overview');

    // Save update
    component.saveReportDefinition();
    expect(analyticsApiSpy.updateReportDefinition).toHaveBeenCalled();
  });

  it('should run custom report definition and set results', () => {
    component.runReport(mockReportDefs[0]);
    expect(analyticsApiSpy.runReportDefinition).toHaveBeenCalledWith('rep-1');
    expect(component.selectedReportResult()).toEqual(mockKpiReport);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should export custom report CSV', () => {
    vi.spyOn(component as unknown as { downloadBlob: () => void }, 'downloadBlob').mockImplementation(() => undefined);
    component.exportReportCsv(mockReportDefs[0]);
    expect(analyticsApiSpy.exportReportDefinition).toHaveBeenCalledWith('rep-1');
    expect(messageSpy.success).toHaveBeenCalledWith('Export completed');
  });

  it('should switch BI feed dataset', () => {
    component.onBiDatasetChange('expenses');
    expect(component.biFeedDataset()).toBe('expenses');
    expect(analyticsApiSpy.getReportingFeed).toHaveBeenCalledWith('expenses', { top: 20, skip: 0 });
  });
});
