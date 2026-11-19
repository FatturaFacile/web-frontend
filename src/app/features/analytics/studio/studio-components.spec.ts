import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnalyticsApiService,
  DmsApiService,
  PivotResult,
  SettingsApiService,
  StudioCatalog,
  StudioDefinition,
  StudioSavedReport,
  StudioSchedule,
} from '@core';
import { icons } from '../../../icons-provider';
import { CalculatedMeasureModalComponent } from './calculated-measure-modal.component';
import { PivotGridComponent } from './pivot-grid.component';
import { ReportStudioComponent } from './report-studio.component';
import { ReportsHubComponent } from './reports-hub.component';
import { ScheduleDrawerComponent } from './schedule-drawer.component';

const download = vi.hoisted(() => vi.fn());
vi.mock('../../general-ledger/shared/gl-dates', () => ({ downloadBlob: download }));

const envelope = <T>(data: T) => ({ success: true, message: '', data });

const catalog: StudioCatalog = {
  datasets: [
    {
      key: 'sales_lines',
      label: 'Sales lines',
      module: 'invoicing',
      supports_period: true,
      period_dimension: 'date',
      dimensions: [
        { key: 'customer', label: 'Customer', type: 'string', operators: ['eq', 'in', 'contains'] },
        {
          key: 'date',
          label: 'Date',
          type: 'date',
          operators: ['gte', 'between'],
          granularities: ['day', 'month', 'year'],
        },
      ],
      measures: [{ key: 'net_amount', label: 'Net amount', unit: 'currency' }],
    },
    {
      key: 'timesheets',
      label: 'Timesheets',
      module: 'projects',
      supports_period: true,
      period_dimension: 'work_date',
      dimensions: [],
      measures: [{ key: 'hours', label: 'Hours', unit: 'quantity' }],
    },
  ],
  options: {
    filter_logic: ['and', 'or'],
    filter_max_depth: 3,
    measure_operators: ['eq', 'gt'],
    granularities: ['day', 'week', 'month', 'quarter', 'year'],
    period_presets: ['month_to_date', 'year_to_date'],
    max_dimensions: 4,
    max_measures: 8,
    formats: ['csv', 'excel_csv', 'xlsx', 'pdf', 'json'],
    locales: ['it-CH', 'de-CH', 'fr-CH', 'it-IT', 'en'],
    chart_types: ['bar', 'stacked_bar', 'line', 'area', 'pie', 'donut', 'combo'],
    formatting_operators: ['gt', 'lt', 'between'],
    background_tokens: ['none', 'red', 'green'],
    text_tokens: ['default', 'white'],
    calculated: {
      functions: ['ABS', 'ROUND', 'COALESCE', 'NULLIF'],
      formats: ['currency', 'number', 'percentage', 'integer'],
      max_fields: 10,
    },
    visibilities: ['private', 'role_shared', 'tenant_public'],
    delivery_channels: ['email', 'telegram', 'dms', 'webhook', 'sftp'],
    schedule_modes: ['daily', 'weekly', 'monthly', 'cron'],
  },
};

const cell = (
  value: string,
  styles: Record<string, { background: string; text: string }> = {},
) => ({ values: { net_amount: value }, styles });

const pivot: PivotResult = {
  row_dimensions: [
    { key: 'customer', label: 'Customer', type: 'string', granularity: null },
    { key: 'currency', label: 'Currency', type: 'string', granularity: null },
  ],
  column_dimensions: [],
  values: [
    {
      key: 'net_amount',
      label: 'Net amount',
      unit: 'currency',
      format: 'currency',
      calculated: false,
    },
  ],
  column_headers: [],
  has_total_column: false,
  rows: [
    {
      type: 'data',
      level: 2,
      keys: ['Acme', 'EUR'],
      label: 'Acme / EUR',
      cells: [],
      total: cell('150.00', { net_amount: { background: 'red', text: 'white' } }),
    },
    {
      type: 'data',
      level: 2,
      keys: ['Acme', 'CHF'],
      label: 'Acme / CHF',
      cells: [],
      total: cell('50.00'),
    },
    { type: 'subtotal', level: 1, keys: ['Acme'], label: 'Acme', cells: [], total: cell('200.00') },
    {
      type: 'data',
      level: 2,
      keys: ['Beta', 'EUR'],
      label: 'Beta / EUR',
      cells: [],
      total: cell('300.00'),
    },
    { type: 'grand_total', level: 0, keys: [], label: '', cells: [], total: cell('500.00') },
  ],
  chart: null,
  meta: {
    dataset: 'sales_lines',
    truncated: false,
    layout: { rows: ['customer', 'currency'], columns: [], subtotals: true, grand_totals: true },
  },
};

const saved: StudioSavedReport = {
  id: 'r1',
  user_id: 'u1',
  name: 'Sales matrix',
  description: null,
  dataset: 'sales_lines',
  spec: { dimensions: ['customer'], measures: ['net_amount'] },
  pivot: { rows: ['customer'], columns: [], subtotals: true, grand_totals: true },
  calculated_fields: [],
  conditional_formatting: [],
  chart_config: {},
  visibility: 'private',
  shared_role_ids: [],
  is_shared: false,
  shared_with: [],
  is_owner: true,
  created_at: null,
  updated_at: null,
};

const schedule: StudioSchedule = {
  id: 's1',
  designed_report_id: 'r1',
  name: 'Monday digest',
  frequency: 'cron',
  cron_expression: '0 7 * * 1',
  timezone: 'Europe/Zurich',
  locale: 'it-CH',
  format: 'xlsx',
  recipient_user_ids: [],
  external_emails: [],
  delivery_channels: { email: true, telegram_chat_ids: [], dms_folder_id: null, webhook_url: null },
  sftp: null,
  webhook_secret_set: false,
  is_active: true,
  next_run_at: '2027-03-22T06:00:00+00:00',
  next_run_on: null,
  last_run_at: null,
  last_status: 'failed',
  last_error: 'telegram: not configured',
};

describe('report and pivot studio', () => {
  const api = {
    getStudioCatalog: vi.fn(),
    runPivot: vi.fn(),
    exportStudio: vi.fn(),
    getStudioReports: vi.fn(),
    getStudioReport: vi.fn(),
    createStudioReport: vi.fn(),
    updateStudioReport: vi.fn(),
    getStudioSchedules: vi.fn(),
    createStudioSchedule: vi.fn(),
    updateStudioSchedule: vi.fn(),
    runStudioScheduleNow: vi.fn(),
    previewCron: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const settingsApi = { getTenantUsers: vi.fn() };
  const dmsApi = { getFolders: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getStudioCatalog.mockReturnValue(of(envelope(catalog)));
    api.runPivot.mockReturnValue(of(envelope(pivot)));
    api.getStudioReports.mockReturnValue(
      of(
        envelope([
          saved,
          { ...saved, id: 'r2', name: 'Shared one', is_owner: false, visibility: 'role_shared' },
          {
            ...saved,
            id: 'r3',
            name: 'Company wide',
            is_owner: false,
            visibility: 'tenant_public',
          },
        ]),
      ),
    );
    api.getStudioSchedules.mockReturnValue(
      of(
        envelope([schedule, { ...schedule, id: 's2', frequency: 'weekly', cron_expression: null }]),
      ),
    );
    api.previewCron.mockReturnValue(
      of(envelope({ next_runs: ['2027-03-22T07:00:00+01:00', '2027-03-29T07:00:00+02:00'] })),
    );
    settingsApi.getTenantUsers.mockReturnValue(
      of(
        envelope([
          { id: 'u1', name: 'Anna', email: 'anna@example.test', role: 'admin', is_active: true },
        ]),
      ),
    );
    dmsApi.getFolders.mockReturnValue(of(envelope([{ id: 'f1', name: 'Reports' }])));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: AnalyticsApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: SettingsApiService, useValue: settingsApi },
        { provide: DmsApiService, useValue: dmsApi },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  describe('studio designer', () => {
    it('builds a pivot from the pills, runs it and shows the matrix', async () => {
      vi.useFakeTimers();
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      const host = fixture.nativeElement as HTMLElement;

      expect(component.state().dataset).toBe('sales_lines');
      expect(component.runnable()).toBe(false);
      expect(host.textContent).toContain('ANALYTICS_STUDIO.EMPTY');

      (host.querySelector('[data-testid="add-rows-customer"]') as HTMLButtonElement).click();
      (host.querySelector('[data-testid="add-columns-date"]') as HTMLButtonElement).click();
      (host.querySelector('[data-testid="add-values-net_amount"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component.state().rows).toEqual(['customer']);
      expect(component.state().columns).toEqual(['date:month']);
      expect(component.state().values).toEqual(['net_amount']);

      await vi.advanceTimersByTimeAsync(400);
      fixture.detectChanges();

      expect(api.runPivot).toHaveBeenCalledTimes(1);
      const sent = api.runPivot.mock.calls[0][0] as StudioDefinition;
      expect(sent.dataset).toBe('sales_lines');
      expect(sent.spec.dimensions).toEqual(['customer', 'date:month']);
      expect(sent.pivot).toEqual({
        rows: ['customer'],
        columns: ['date:month'],
        subtotals: true,
        grand_totals: true,
      });
      expect(host.querySelector('[data-testid="pivot-grid"]')).not.toBeNull();
      expect(host.textContent).toContain('150.00');
      expect(host.textContent).toContain('ANALYTICS_STUDIO.GRAND_TOTAL');
    });

    it('keeps only the latest run when the shelves change quickly', async () => {
      vi.useFakeTimers();
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.addToShelf('values', 'net_amount');
      await vi.advanceTimersByTimeAsync(100);
      component.addToShelf('rows', 'customer');
      await vi.advanceTimersByTimeAsync(400);

      expect(api.runPivot).toHaveBeenCalledTimes(1);
      expect((api.runPivot.mock.calls[0][0] as StudioDefinition).spec.dimensions).toEqual([
        'customer',
      ]);
    });

    it('switches between grid, chart and split view', () => {
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.addToShelf('values', 'net_amount');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('app-pivot-grid')).not.toBeNull();
      expect(host.querySelector('app-pivot-chart')).toBeNull();

      component.view.set('chart');
      fixture.detectChanges();
      expect(host.querySelector('app-pivot-grid')).toBeNull();
      expect(host.querySelector('app-pivot-chart')).not.toBeNull();

      component.view.set('split');
      fixture.detectChanges();
      expect(host.querySelector('app-pivot-grid')).not.toBeNull();
      expect(host.querySelector('app-pivot-chart')).not.toBeNull();
    });

    it('exports in the chosen format and locale', () => {
      api.exportStudio.mockReturnValue(of(new Blob(['x'])));
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.addToShelf('values', 'net_amount');
      component.exportLocale.set('it-CH');

      component.export('xlsx');

      expect(api.exportStudio).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'xlsx', locale: 'it-CH', dataset: 'sales_lines' }),
      );
      expect(download).toHaveBeenCalledWith(expect.any(Blob), 'sales_lines.xlsx');
    });

    it('saves the report with its visibility and the roles it is shared with', () => {
      api.createStudioReport.mockReturnValue(
        of(envelope({ ...saved, visibility: 'role_shared', shared_role_ids: ['accountant'] })),
      );
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.addToShelf('rows', 'customer');
      component.addToShelf('values', 'net_amount');

      component.save({
        name: 'Sales matrix',
        description: 'Monthly',
        visibility: 'role_shared',
        sharedRoleIds: ['accountant'],
      });

      expect(api.createStudioReport).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sales matrix',
          description: 'Monthly',
          visibility: 'role_shared',
          shared_role_ids: ['accountant'],
          dataset: 'sales_lines',
        }),
      );
      expect(component.saved()?.id).toBe('r1');
      expect(message.success).toHaveBeenCalled();

      // A second save updates the same report.
      api.updateStudioReport.mockReturnValue(of(envelope(saved)));
      component.save({
        name: 'Renamed',
        description: null,
        visibility: 'private',
        sharedRoleIds: [],
      });
      expect(api.updateStudioReport).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ name: 'Renamed' }),
      );
    });

    it('shows the error of the API instead of the matrix', async () => {
      vi.useFakeTimers();
      api.runPivot.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: {
                message: 'Bad',
                errors: { 'spec.dimensions.0': ['Unknown dimension for this dataset.'] },
              },
            }),
        ),
      );
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      fixture.componentInstance.addToShelf('values', 'net_amount');
      await vi.advanceTimersByTimeAsync(400);
      fixture.detectChanges();

      expect(fixture.componentInstance.errorText()).toBe('Unknown dimension for this dataset.');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Unknown dimension for this dataset.',
      );
    });

    it('adds a calculated measure to the values and removes its rules with it', () => {
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.addToShelf('values', 'net_amount');
      component.addCalculated({
        key: 'calc_1',
        label: 'Double',
        formula: 'net_amount * 2',
        format: 'currency',
      });
      component.addRule();
      component.updateRule(0, { target: 'calc_1' });
      expect(component.definition().calculated_fields).toHaveLength(1);
      expect(component.state().formatting[0].target).toBe('calc_1');

      component.removeCalculated('calc_1');
      expect(component.state().calculated).toEqual([]);
      expect(component.state().formatting).toEqual([]);
    });

    it('opens the schedule drawer only for a saved report', () => {
      const fixture = TestBed.createComponent(ReportStudioComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.openSchedule();
      expect(component.saveOpen()).toBe(true);
      expect(component.scheduleOpen()).toBe(false);

      component.saved.set(saved);
      component.openSchedule();
      expect(component.scheduleOpen()).toBe(true);
    });
  });

  describe('pivot grid', () => {
    it('shows subtotals and the grand total and collapses a group to its subtotal', () => {
      const fixture = TestBed.createComponent(PivotGridComponent);
      fixture.componentRef.setInput('result', pivot);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const types = () =>
        [...host.querySelectorAll('tbody tr')].map((row) => row.getAttribute('data-row-type'));

      expect(types()).toEqual(['data', 'data', 'subtotal', 'data', 'grand_total']);
      // The conditional formatting of the API is applied from fixed palettes.
      const first = host.querySelector('tbody tr td') as HTMLElement;
      expect(first.style.color).toBe('rgb(255, 255, 255)');
      expect(first.style.background).not.toBe('');

      (host.querySelector('button.toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(types()).toEqual(['subtotal', 'data', 'grand_total']);
      expect(host.querySelector('button.toggle')?.getAttribute('aria-expanded')).toBe('false');

      fixture.componentInstance.expandAll();
      fixture.detectChanges();
      expect(types()).toHaveLength(5);
      fixture.componentInstance.collapseAll();
      fixture.detectChanges();
      expect(types()).toEqual(['subtotal', 'data', 'grand_total']);
    });

    it('lays out column groups with a header per value and a total column', () => {
      const withColumns: PivotResult = {
        ...pivot,
        row_dimensions: [{ key: 'customer', label: 'Customer', type: 'string', granularity: null }],
        column_headers: [
          { index: 0, tuple: ['2026'], label: '2026' },
          { index: 1, tuple: ['2027'], label: '2027' },
        ],
        has_total_column: true,
        rows: [
          {
            type: 'data',
            level: 1,
            keys: ['Acme'],
            label: 'Acme',
            cells: [cell('100.00'), null],
            total: cell('100.00'),
          },
        ],
      };
      const fixture = TestBed.createComponent(PivotGridComponent);
      fixture.componentRef.setInput('result', withColumns);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelectorAll('thead tr')).toHaveLength(2);
      expect(
        [...host.querySelectorAll('thead tr:first-child th.group')].map((th) =>
          th.textContent?.trim(),
        ),
      ).toEqual(['2026', '2027', 'ANALYTICS_STUDIO.TOTAL']);
      expect(host.querySelectorAll('tbody tr:first-child td')).toHaveLength(3);
    });
  });

  describe('calculated measure modal', () => {
    const definition: StudioDefinition = {
      dataset: 'sales_lines',
      spec: { dimensions: [], measures: ['net_amount'] },
      pivot: { rows: ['customer'], columns: [], subtotals: true, grand_totals: true },
      calculated_fields: [],
      conditional_formatting: [
        { target: 'net_amount', operator: 'gt', value: '1', background: 'red', text: 'default' },
      ],
      chart_config: {
        enabled: true,
        chartType: 'bar',
        xAxis: 'customer',
        series: ['net_amount'],
        showLegend: true,
        showDataLabels: false,
      },
    };

    function modal() {
      const fixture = TestBed.createComponent(CalculatedMeasureModalComponent);
      fixture.componentRef.setInput('definition', definition);
      fixture.componentRef.setInput('references', ['net_amount']);
      fixture.componentRef.setInput('existingKeys', ['net_amount']);
      fixture.detectChanges();

      return fixture.componentInstance;
    }

    it('rejects a bad formula locally without calling the backend', () => {
      const component = modal();
      component.formula.set('net_amount; DROP TABLE invoices');
      component.check();

      expect(component.status()).toBe('error');
      expect(component.problem()).toBe('ANALYTICS_STUDIO.FORMULA_CHARACTERS');
      expect(api.runPivot).not.toHaveBeenCalled();
      expect(component.canSave()).toBe(false);
    });

    it('validates a formula with the backend on an aggregate-only run, then emits the measure', () => {
      const component = modal();
      const emitted = vi.fn();
      component.saved.subscribe(emitted);
      component.visible.set(true);
      component.label.set('Double');
      component.formula.set('ROUND(net_amount * 2, 2)');
      component.format.set('currency');
      component.check();

      expect(api.runPivot).toHaveBeenCalledTimes(1);
      const sent = api.runPivot.mock.calls[0][0] as StudioDefinition;
      expect(sent.calculated_fields).toEqual([
        { key: 'calc_1', label: 'Double', formula: 'ROUND(net_amount * 2, 2)', format: 'currency' },
      ]);
      expect(sent.pivot.rows).toEqual([]);
      expect(sent.conditional_formatting).toEqual([]);
      expect(component.status()).toBe('ok');
      expect(component.canSave()).toBe(true);

      component.save();
      expect(emitted).toHaveBeenCalledWith({
        key: 'calc_1',
        label: 'Double',
        formula: 'ROUND(net_amount * 2, 2)',
        format: 'currency',
      });
      expect(component.visible()).toBe(false);
      expect(component.formula()).toBe('');
    });

    it('shows the message of the backend parser and keeps the measure from being saved', () => {
      api.runPivot.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: {
                errors: {
                  calculated_fields: ['Calculated field error: Function "SLEEP" is not allowed.'],
                },
              },
            }),
        ),
      );
      const component = modal();
      component.label.set('Odd');
      component.formula.set('net_amount * 2');
      component.check();

      expect(component.status()).toBe('error');
      expect(component.problem()).toBe('Calculated field error: Function "SLEEP" is not allowed.');
      component.save();
      expect(component.visible()).toBe(false);
    });

    it('waits for the user to stop typing before it asks the backend', () => {
      vi.useFakeTimers();
      const component = modal();
      component.label.set('Double');
      component.onFormula('net_amount * 2');
      component.onFormula('net_amount * 3');
      expect(api.runPivot).not.toHaveBeenCalled();
      expect(component.status()).toBe('checking');

      vi.advanceTimersByTime(600);
      expect(api.runPivot).toHaveBeenCalledTimes(1);
    });

    it('inserts a measure into the formula', () => {
      const component = modal();
      component.insert('net_amount');
      component.insert('net_amount');

      expect(component.formula()).toBe('net_amount net_amount');
    });
  });

  describe('cron schedule drawer', () => {
    function drawer(current: StudioSchedule | null = null) {
      const fixture = TestBed.createComponent(ScheduleDrawerComponent);
      fixture.componentRef.setInput('reportId', 'r1');
      fixture.componentRef.setInput('schedule', current);
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();

      return fixture.componentInstance;
    }

    it('starts on the weekly Monday preset and previews its next runs from the API', () => {
      const component = drawer();

      expect(component.preset()).toBe('weekly_monday');
      expect(component.cron()).toBe('0 7 * * 1');
      expect(api.previewCron).toHaveBeenCalledWith('0 7 * * 1', 'Europe/Zurich');
      expect(component.nextRuns()).toEqual(['2027-03-22 07:00', '2027-03-29 07:00']);
      expect(component.users()).toHaveLength(1);
      expect(component.folders()).toHaveLength(1);
    });

    it('sets the expression of each preset and keeps a typed expression as custom', () => {
      vi.useFakeTimers();
      const component = drawer();

      component.choosePreset('daily');
      expect(component.cron()).toBe('0 7 * * *');
      component.choosePreset('monthly_first');
      expect(component.cron()).toBe('0 7 1 * *');
      component.choosePreset('custom');
      component.setCron('15 9 * * 5');
      vi.advanceTimersByTime(500);

      expect(component.preset()).toBe('custom');
      expect(api.previewCron).toHaveBeenLastCalledWith('15 9 * * 5', 'Europe/Zurich');
    });

    it('blocks saving an expression the API refuses and shows why', () => {
      const component = drawer();
      api.previewCron.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: {
                errors: {
                  cron_expression: ['A report cannot run more often than every 5 minutes.'],
                },
              },
            }),
        ),
      );
      component.preview();

      expect(component.previewError()).toBe('A report cannot run more often than every 5 minutes.');
      expect(component.canSave()).toBe(false);
    });

    it('creates the schedule with the channels, locale, format and zone, and shows the webhook secret once', () => {
      api.createStudioSchedule.mockReturnValue(
        of(envelope({ schedule, webhook_secret: 'whsec_abc' })),
      );
      const component = drawer();
      const emitted = vi.fn();
      component.saved.subscribe(emitted);
      component.name.set('Monday digest');
      component.locale.set('de-CH');
      component.format.set('pdf');
      component.timezone.set('Europe/Rome');
      component.userIds.set(['u1']);
      component.externalEmails.set(['auditor@example.test']);
      component.telegramChats.set(['-100123']);
      component.folderId.set('f1');
      component.webhookUrl.set('https://hooks.example.test/reports');

      expect(component.canSave()).toBe(true);
      component.save();

      expect(api.createStudioSchedule).toHaveBeenCalledWith({
        designed_report_id: 'r1',
        name: 'Monday digest',
        cron_expression: '0 7 * * 1',
        timezone: 'Europe/Rome',
        locale: 'de-CH',
        format: 'pdf',
        recipient_user_ids: ['u1'],
        external_emails: ['auditor@example.test'],
        delivery_channels: {
          email: true,
          telegram_chat_ids: ['-100123'],
          dms_folder_id: 'f1',
          webhook_url: 'https://hooks.example.test/reports',
        },
        is_active: true,
      });
      expect(emitted).toHaveBeenCalledWith(schedule);
      expect(component.secret()).toBe('whsec_abc');
      expect(component.visible()).toBe(true);

      component.close();
      expect(component.secret()).toBeNull();
      expect(component.visible()).toBe(false);
    });

    it('updates an existing schedule and needs a channel or a recipient', () => {
      api.updateStudioSchedule.mockReturnValue(of(envelope({ schedule, webhook_secret: null })));
      const component = drawer(schedule);

      expect(component.name()).toBe('Monday digest');
      expect(component.locale()).toBe('it-CH');
      component.save();
      expect(api.updateStudioSchedule).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ cron_expression: '0 7 * * 1', locale: 'it-CH' }),
      );
      expect(component.visible()).toBe(false);

      component.email.set(false);
      expect(component.canSave()).toBe(false);
    });
  });

  describe('reports hub', () => {
    it('groups the reports by who they are for and filters them', () => {
      const fixture = TestBed.createComponent(ReportsHubComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      const names = () => component.visibleReports().map((report) => report.name);

      expect(names()).toEqual(['Sales matrix']);
      component.selectIndex(1);
      expect(names()).toEqual(['Shared one']);
      component.selectIndex(2);
      expect(names()).toEqual(['Company wide']);
      component.search.set('nothing');
      expect(names()).toEqual([]);
    });

    it('lists the cron schedules with their status and runs one now', () => {
      api.runStudioScheduleNow.mockReturnValue(of(envelope(schedule)));
      const fixture = TestBed.createComponent(ReportsHubComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.selectIndex(3);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(component.visibleSchedules().map((item) => item.id)).toEqual(['s1']);
      expect(host.textContent).toContain('0 7 * * 1');
      expect(host.textContent).toContain('ANALYTICS_STUDIO.STATUS_FAILED');

      (host.querySelector('[data-testid="run-now-s1"]') as HTMLButtonElement).click();
      expect(api.runStudioScheduleNow).toHaveBeenCalledWith('s1');
      expect(message.success).toHaveBeenCalled();
    });
  });
});
