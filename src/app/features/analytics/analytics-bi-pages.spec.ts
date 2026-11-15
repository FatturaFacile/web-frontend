import { TestBed } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsApiService, AnalyticsDesignedReport, AnalyticsExportSchedule, AnalyticsSemanticDataset, SettingsApiService } from '@core';
import { icons } from '../../icons-provider';
import { ExportSchedulesComponent } from './export-schedules.component';
import { KpiSnapshotsComponent, toIsoDay } from './kpi-snapshots.component';
import { ReportDesignerComponent } from './report-designer.component';

const envelope = <T>(data: T) => ({ success: true, message: '', data });

const dataset: AnalyticsSemanticDataset = {
  key: 'sales',
  label: 'Sales',
  module: 'invoicing',
  supports_period: true,
  period_dimension: 'date',
  dimensions: [
    { key: 'customer', label: 'Customer', type: 'string', operators: ['eq', 'in'] },
    { key: 'date', label: 'Date', type: 'date', granularities: ['day', 'month'] },
  ],
  measures: [{ key: 'net_amount', label: 'Net amount', unit: 'currency' }],
};

const report: AnalyticsDesignedReport = {
  id: 'r1',
  user_id: 'u1',
  name: 'Sales by customer',
  description: null,
  dataset: 'sales',
  spec: { dimensions: ['customer'], measures: ['net_amount'] },
  is_shared: false,
  shared_with: [],
  is_owner: true,
  created_at: null,
  updated_at: null,
};

const schedule: AnalyticsExportSchedule = {
  id: 's1',
  user_id: 'u1',
  designed_report_id: 'r1',
  frequency: 'weekly',
  day_of_week: 2,
  day_of_month: null,
  format: 'csv',
  delivery: 'email',
  recipients: ['member@example.test'],
  is_active: true,
  next_run_on: '2026-11-17',
  last_run_at: null,
  last_status: null,
  last_error: null,
};

const resultPage = {
  columns: [
    { key: 'customer', label: 'Customer', kind: 'dimension' },
    { key: 'net_amount', label: 'Net amount', kind: 'measure' },
  ],
  rows: [{ customer: 'Acme', net_amount: '10.00' }],
  meta: { dataset: 'sales', page: 1, per_page: 50, total: 1, pages: 1, truncated: false, row_limit: 1000, period: null, comparison_period: null },
};

describe('analytics BI pages', () => {
  const api = {
    getSemanticDatasets: vi.fn(),
    getDesignedReports: vi.fn(),
    runDesigner: vi.fn(),
    exportDesigner: vi.fn(),
    createDesignedReport: vi.fn(),
    updateDesignedReport: vi.fn(),
    deleteDesignedReport: vi.fn(),
    exportDesignedReport: vi.fn(),
    getExportSchedules: vi.fn(),
    createExportSchedule: vi.fn(),
    updateExportSchedule: vi.fn(),
    deleteExportSchedule: vi.fn(),
    getKpiSnapshots: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const settingsApi = { getTenantUsers: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    settingsApi.getTenantUsers.mockReturnValue(of(envelope([{ id: 'u1', name: 'Anna', email: 'anna@example.test', role: 'user', is_active: true }, { id: 'u2', name: 'Off', email: 'off@example.test', role: 'user', is_active: false }])));
    api.getSemanticDatasets.mockReturnValue(of(envelope([dataset])));
    api.getDesignedReports.mockReturnValue(of(envelope([report])));
    api.getExportSchedules.mockReturnValue(of(envelope([schedule])));
    api.getKpiSnapshots.mockReturnValue(
      of(envelope([{ kpi: 'sales', snapshot_date: '2026-11-14', period_from: '2026-11-01', period_to: '2026-11-14', value: '100.00', details: null, computed_at: '2026-11-15T01:10:00Z' }]))
    );
    TestBed.configureTestingModule({
      providers: [provideNzIcons(icons), provideNzI18n(en_US), provideNzDateFnsAdapter(), { provide: AnalyticsApiService, useValue: api }, { provide: NzMessageService, useValue: message }, { provide: SettingsApiService, useValue: settingsApi }],
    });
  });

  it('runs the designer with the spec built from the form', () => {
    api.runDesigner.mockReturnValue(of(envelope(resultPage)));
    const fixture = TestBed.createComponent(ReportDesignerComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.canRun()).toBe(false);
    component.selectDataset('sales');
    component.patch({ dimensions: ['customer', 'date'], granularity: 'month', measures: ['net_amount'], periodPreset: 'last_30_days' });
    expect(component.canRun()).toBe(true);

    component.run(1);
    expect(api.runDesigner).toHaveBeenCalledWith({
      dataset: 'sales',
      spec: {
        dimensions: ['customer', 'date:month'],
        measures: ['net_amount'],
        filters: [],
        sort: [],
        limit: null,
        period: { preset: 'last_30_days' },
        compare: 'none',
      },
      page: 1,
      per_page: 50,
    });
    expect(component.result()?.rows).toHaveLength(1);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Acme');
  });

  it('opens a saved report in the designer and saves changes as an update', () => {
    api.runDesigner.mockReturnValue(of(envelope(resultPage)));
    api.updateDesignedReport.mockReturnValue(of(envelope(report)));
    const fixture = TestBed.createComponent(ReportDesignerComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.load(report);
    expect(component.editingId()).toBe('r1');
    expect(component.state().measures).toEqual(['net_amount']);

    component.save();
    expect(api.updateDesignedReport).toHaveBeenCalledWith('r1', expect.objectContaining({ name: 'Sales by customer', dataset: 'sales' }));
    expect(api.createDesignedReport).not.toHaveBeenCalled();
  });

  it('shares a new report with chosen users and drops the list when it is shared with the company', () => {
    api.createDesignedReport.mockReturnValue(of(envelope(report)));
    api.updateDesignedReport.mockReturnValue(of(envelope(report)));
    const fixture = TestBed.createComponent(ReportDesignerComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.datasetKey.set('sales');
    component.reportName.set('Shared report');

    component.openSave();
    expect(component.shareableUsers().map((user) => user.id)).toEqual(['u1']);

    component.reportSharedWith.set(['u1']);
    component.save();
    expect(api.createDesignedReport).toHaveBeenLastCalledWith(expect.objectContaining({ is_shared: false, shared_with: ['u1'] }));

    component.reportShared.set(true);
    component.save();
    expect(api.updateDesignedReport).toHaveBeenLastCalledWith('r1', expect.objectContaining({ is_shared: true, shared_with: [] }));
  });

  it('lists the schedules and sends the day only for the chosen frequency', () => {
    api.createExportSchedule.mockReturnValue(of(envelope(schedule)));
    const fixture = TestBed.createComponent(ExportSchedulesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.schedules()).toHaveLength(1);
    component.openForm(null);
    component.form.patchValue({ designed_report_id: 'r1', frequency: 'monthly', day_of_month: 5, delivery: 'documents', recipients: ['x@example.test'] });

    expect(component.payload()).toEqual({
      designed_report_id: 'r1',
      frequency: 'monthly',
      day_of_week: null,
      day_of_month: 5,
      format: 'csv',
      delivery: 'documents',
      recipients: [],
      is_active: true,
    });

    component.save();
    expect(api.createExportSchedule).toHaveBeenCalledTimes(1);
  });

  it('pauses a schedule with an update that keeps its settings', () => {
    api.updateExportSchedule.mockReturnValue(of(envelope(schedule)));
    const fixture = TestBed.createComponent(ExportSchedulesComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggle(schedule, false);
    expect(api.updateExportSchedule).toHaveBeenCalledWith('s1', expect.objectContaining({ frequency: 'weekly', day_of_week: 2, is_active: false }));
  });

  it('loads the KPI snapshots and filters them by KPI', () => {
    const fixture = TestBed.createComponent(KpiSnapshotsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.kpiKeys()).toEqual(['sales']);
    component.kpiFilter.set('other');
    expect(component.visible()).toHaveLength(0);
    expect(toIsoDay(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(toIsoDay(null)).toBeUndefined();
  });
});
