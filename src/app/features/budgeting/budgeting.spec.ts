import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AccountingApiService,
  BudgetDriver,
  BudgetingApiService,
  BudgetingDashboard,
  BudgetPlanLine,
  BudgetVariance,
  BudgetVersion,
  GeneralLedgerApiService,
  TranslateService,
} from '@core';
import { BudgetingCompareComponent } from './budgeting-compare.component';
import { BudgetingDashboardComponent } from './budgeting-dashboard.component';
import { BudgetingDriversComponent } from './budgeting-drivers.component';
import { BudgetingLinesComponent } from './budgeting-lines.component';
import { BudgetingVarianceComponent } from './budgeting-variance.component';
import { BudgetingVersionDetailComponent } from './budgeting-version-detail.component';
import { BudgetingVersionsComponent } from './budgeting-versions.component';
import { apiErrorText, blankToNull, loadAccounts, loadCostCenters, parseWeights, validWeights } from './budgeting.util';

const version: BudgetVersion = {
  id: 'bv-1',
  name: 'Budget 2028',
  description: null,
  fiscal_year: 2028,
  year_start: '2028-01-01',
  version_type: 'budget',
  status: 'draft',
  currency: 'EUR',
  base_version_id: null,
  reforecast_from_period: null,
  seasonal_weights: null,
  submitted_by: null,
  submitted_at: null,
  approved_by: null,
  approved_at: null,
  locked_by: null,
  locked_at: null,
  lines_count: 12,
  drivers_count: 1,
  total_amount: '1200.00',
  approvals: [],
};

const line: BudgetPlanLine = {
  id: 'bl-1',
  version_id: 'bv-1',
  account_id: 'ac-1',
  cost_center_id: null,
  project_id: null,
  period: 1,
  amount: '100.00',
  source: 'manual',
  driver_id: null,
  notes: null,
};

const driver: BudgetDriver = {
  id: 'dr-1',
  version_id: 'bv-1',
  name: 'Headcount',
  account_id: 'ac-1',
  cost_center_id: null,
  project_id: null,
  quantity: '10.000',
  rate: '2500.0000',
  total_amount: '25000.00',
  spread_method: 'even',
  percentages: null,
  start_period: 1,
  end_period: 12,
  is_active: true,
};

const variance: BudgetVariance = {
  version_id: 'bv-1',
  through_period: 12,
  group_by: 'account',
  rows: [{ key: 'ac-1', label: 'Rent', code: '6100', budget: '1200.00', actual: '1300.00', variance: '100.00', variance_percent: '8.3', is_favorable: false, status: 'over' }],
  totals: { budget: '1200.00', actual: '1300.00', variance: '100.00', variance_percent: '8.3', adverse: '100.00', favorable: '0.00' },
};

const dashboard: BudgetingDashboard = {
  versions: { total: 1, by_status: { draft: 0, submitted: 1, approved: 0, locked: 0 }, by_type: { budget: 1, forecast: 0, rolling_forecast: 0 } },
  pending_approval: [{ id: 'bv-1', name: 'Budget 2028', fiscal_year: 2028, submitted_at: null }],
  selected_version: { id: 'bv-1', name: 'Budget 2028', fiscal_year: 2028, status: 'approved', version_type: 'budget', currency: 'EUR' },
  through_period: 2,
  totals: { annual_budget: '1200.00', budget: '200.00', actual: '270.00', variance: '70.00', variance_percent: '35.0', consumption_percent: '22.5' },
  series: [{ period: 1, month: '2028-01', budget: '100.00', actual: '150.00', cumulative_budget: '100.00', cumulative_actual: '150.00' }],
  top_overruns: variance.rows,
  drivers_count: 1,
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const accountingSpy = { getAccounts: vi.fn() };
const ledgerSpy = { getCostCenters: vi.fn() };

function configure(api: Record<string, unknown>, extra: unknown[] = []): void {
  accountingSpy.getAccounts.mockReturnValue(of({ data: [{ id: 'ac-1', account_code: '6100', name: 'Rent' }] }));
  ledgerSpy.getCostCenters.mockReturnValue(of({ data: [{ id: 'cc-1', code: 'CC1', name: 'Sales', is_active: true }] }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BudgetingApiService, useValue: api },
      { provide: AccountingApiService, useValue: accountingSpy },
      { provide: GeneralLedgerApiService, useValue: ledgerSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
      ...(extra as never[]),
    ],
  });
}

describe('budgeting util', () => {
  it('reads the first validation message of a 422', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { percentages: ['The percentages must add up to 100'] } } }))).toBe('The percentages must add up to 100');
    expect(apiErrorText(new HttpErrorResponse({ status: 500, error: { message: 'Server error' } }))).toBe('Server error');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('turns blanks into null', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull(' x ')).toBe('x');
  });

  it('parses and validates the seasonal weights', () => {
    expect(parseWeights('')).toBeNull();
    expect(parseWeights('1, 2;3 4')).toEqual([1, 2, 3, 4]);
    expect(validWeights('')).toBe(true);
    expect(validWeights('1,1,1,1,1,1,1,1,1,1,1,3')).toBe(true);
    expect(validWeights('1,2,3')).toBe(false);
    expect(validWeights('0,0,0,0,0,0,0,0,0,0,0,0')).toBe(false);
    expect(validWeights('1,1,1,1,1,1,1,1,1,1,1,x')).toBe(false);
  });

  it('gives empty lists to members without access to the ledger', () => {
    accountingSpy.getAccounts.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    ledgerSpy.getCostCenters.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    let accounts: unknown[] | null = null;
    let centers: unknown[] | null = null;
    loadAccounts(accountingSpy as unknown as AccountingApiService).subscribe((result) => (accounts = result));
    loadCostCenters(ledgerSpy as unknown as GeneralLedgerApiService).subscribe((result) => (centers = result));

    expect(accounts).toEqual([]);
    expect(centers).toEqual([]);
  });
});

describe('BudgetingDashboardComponent', () => {
  const api = { getDashboard: vi.fn(), getVersions: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDashboard.mockReturnValue(of({ data: dashboard }));
    api.getVersions.mockReturnValue(of({ data: [version] }));
    configure(api);
  });

  it('loads the dashboard and reloads it for a chosen version', () => {
    const fixture = TestBed.createComponent(BudgetingDashboardComponent);
    fixture.detectChanges();

    expect(api.getDashboard).toHaveBeenCalledWith(undefined);
    expect(fixture.componentInstance.dashboard()?.totals?.consumption_percent).toBe('22.5');

    fixture.componentInstance.selectVersion('bv-1');
    expect(api.getDashboard).toHaveBeenLastCalledWith('bv-1');
  });

  it('shows the reason of a failed load', () => {
    api.getDashboard.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })));
    const fixture = TestBed.createComponent(BudgetingDashboardComponent);
    fixture.detectChanges();

    expect(messageSpy.error).toHaveBeenCalledWith('Forbidden');
  });
});

describe('BudgetingVersionsComponent', () => {
  const api = { getVersions: vi.fn(), createVersion: vi.fn(), copyVersion: vi.fn(), reforecastVersion: vi.fn(), deleteVersion: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getVersions.mockReturnValue(of({ data: [version] }));
    api.createVersion.mockReturnValue(of({ data: version }));
    api.copyVersion.mockReturnValue(of({ data: version }));
    api.reforecastVersion.mockReturnValue(of({ data: version }));
    api.deleteVersion.mockReturnValue(of(undefined));
    configure(api);
  });

  it('filters the versions', () => {
    const fixture = TestBed.createComponent(BudgetingVersionsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getVersions).toHaveBeenCalledWith({ fiscal_year: undefined, status: undefined, version_type: undefined, per_page: 100 });
    component.fiscalYear.set(2028);
    component.status.set('approved');
    component.type.set('budget');
    component.load();
    expect(api.getVersions).toHaveBeenLastCalledWith({ fiscal_year: 2028, status: 'approved', version_type: 'budget', per_page: 100 });
  });

  it('creates a version with the API field names and the seasonal weights as numbers', () => {
    const fixture = TestBed.createComponent(BudgetingVersionsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCreate();
    component.createForm.patchValue({ name: 'Budget 2029', fiscal_year: 2029, year_start: '', currency: 'eur', seasonal_weights: '1,1,1,1,1,1,1,1,1,1,1,3', description: ' ' });
    expect(component.createForm.valid).toBe(true);
    component.saveCreate();

    expect(api.createVersion).toHaveBeenCalledWith({
      name: 'Budget 2029',
      description: null,
      fiscal_year: 2029,
      year_start: null,
      version_type: 'budget',
      currency: 'EUR',
      seasonal_weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3],
    });
  });

  it('refuses seasonal weights that are not twelve numbers', () => {
    const fixture = TestBed.createComponent(BudgetingVersionsComponent);
    fixture.detectChanges();

    fixture.componentInstance.openCreate();
    fixture.componentInstance.createForm.patchValue({ name: 'Budget', seasonal_weights: '1,2,3' });
    expect(fixture.componentInstance.createForm.valid).toBe(false);
  });

  it('copies a version as a forecast and re-forecasts an approved one', () => {
    const fixture = TestBed.createComponent(BudgetingVersionsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCopy(version);
    component.copyForm.patchValue({ name: 'Forecast Q2' });
    component.saveCopy();
    expect(api.copyVersion).toHaveBeenCalledWith('bv-1', { name: 'Forecast Q2', version_type: 'forecast' });

    component.openReforecast(version);
    component.reforecastForm.patchValue({ name: 'RF 1', from_period: 4, mode: 'keep_remaining', adjustment_percent: 10 });
    component.saveReforecast();
    expect(api.reforecastVersion).toHaveBeenCalledWith('bv-1', { name: 'RF 1', from_period: 4, mode: 'keep_remaining', adjustment_percent: 10 });
  });

  it('shows the API reason when a version cannot be deleted', () => {
    api.deleteVersion.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { status: ['Only a draft version can be changed'] } } })));
    const fixture = TestBed.createComponent(BudgetingVersionsComponent);
    fixture.detectChanges();

    fixture.componentInstance.remove(version);
    expect(messageSpy.error).toHaveBeenCalledWith('Only a draft version can be changed');
  });
});

describe('BudgetingLinesComponent', () => {
  const api = { getLines: vi.fn(), saveLine: vi.fn(), updateLine: vi.fn(), deleteLine: vi.fn(), spread: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getLines.mockReturnValue(of({ data: [line] }));
    api.saveLine.mockReturnValue(of({ data: line }));
    api.updateLine.mockReturnValue(of({ data: line }));
    api.deleteLine.mockReturnValue(of(undefined));
    api.spread.mockReturnValue(of({ data: [line] }));
    configure(api);
  });

  it('loads the lines and the dimensions of the ledger', () => {
    const fixture = TestBed.createComponent(BudgetingLinesComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    expect(api.getLines).toHaveBeenCalledWith('bv-1', { per_page: 100 });
    expect(fixture.componentInstance.accountLabel('ac-1')).toBe('6100 Rent');
    expect(fixture.componentInstance.costCenterLabel('cc-1')).toBe('CC1 Sales');
    expect(fixture.componentInstance.costCenterLabel(null)).toBe('');
  });

  it('saves a line with the API field names and tells the parent', () => {
    const fixture = TestBed.createComponent(BudgetingLinesComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    fixture.componentInstance.openModal();
    fixture.componentInstance.form.patchValue({ account_id: 'ac-1', cost_center_id: 'cc-1', period: 3, amount: 250.5, project_id: '' });
    fixture.componentInstance.save();

    expect(api.saveLine).toHaveBeenCalledWith('bv-1', { account_id: 'ac-1', cost_center_id: 'cc-1', project_id: null, period: 3, amount: '250.5', notes: null });
    expect(changed).toHaveBeenCalled();
  });

  it('rejects a project id that is not a UUID', () => {
    const fixture = TestBed.createComponent(BudgetingLinesComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    fixture.componentInstance.openModal();
    fixture.componentInstance.form.patchValue({ account_id: 'ac-1', amount: 1, project_id: 'nope' });
    expect(fixture.componentInstance.form.valid).toBe(false);
    fixture.componentInstance.form.patchValue({ project_id: '7d3f8a4e-1b2c-4d5e-8f60-123456789abc' });
    expect(fixture.componentInstance.form.valid).toBe(true);
  });

  it('spreads an amount with percentages as numbers', () => {
    const fixture = TestBed.createComponent(BudgetingLinesComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    fixture.componentInstance.openSpread();
    fixture.componentInstance.spreadForm.patchValue({ account_id: 'ac-1', total_amount: 1000, method: 'percentage', start_period: 4, end_period: 6, percentages: '50, 30, 20' });
    fixture.componentInstance.saveSpread();

    expect(api.spread).toHaveBeenCalledWith('bv-1', {
      account_id: 'ac-1',
      cost_center_id: null,
      project_id: null,
      total_amount: '1000',
      method: 'percentage',
      start_period: 4,
      end_period: 6,
      percentages: [50, 30, 20],
      notes: null,
    });
  });

  it('sends no percentages for an even spread and shows the API reason on failure', () => {
    const fixture = TestBed.createComponent(BudgetingLinesComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    fixture.componentInstance.openSpread();
    fixture.componentInstance.spreadForm.patchValue({ account_id: 'ac-1', total_amount: 600, method: 'even', percentages: '1,2' });
    fixture.componentInstance.saveSpread();
    expect(api.spread).toHaveBeenCalledWith('bv-1', expect.objectContaining({ method: 'even', percentages: null }));

    api.spread.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { percentages: ['Enter exactly 3 percentages'] } } })));
    fixture.componentInstance.saveSpread();
    expect(messageSpy.error).toHaveBeenCalledWith('Enter exactly 3 percentages');
  });

  it('removes a line', () => {
    const fixture = TestBed.createComponent(BudgetingLinesComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    fixture.componentInstance.remove(line);
    expect(api.deleteLine).toHaveBeenCalledWith('bl-1');
  });
});

describe('BudgetingDriversComponent', () => {
  const api = { getDrivers: vi.fn(), createDriver: vi.fn(), updateDriver: vi.fn(), deleteDriver: vi.fn(), generateDriver: vi.fn(), generateDrivers: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDrivers.mockReturnValue(of({ data: [driver] }));
    api.createDriver.mockReturnValue(of({ data: driver }));
    api.updateDriver.mockReturnValue(of({ data: driver }));
    api.deleteDriver.mockReturnValue(of(undefined));
    api.generateDriver.mockReturnValue(of({ data: [line, line] }));
    api.generateDrivers.mockReturnValue(of({ data: { drivers: 2, lines: 8 } }));
    configure(api);
  });

  it('creates a driver with the API field names', () => {
    const fixture = TestBed.createComponent(BudgetingDriversComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();

    fixture.componentInstance.openModal();
    fixture.componentInstance.form.patchValue({ name: 'Licences', account_id: 'ac-1', quantity: 4, rate: 250, spread_method: 'percentage', percentages: '25, 75', start_period: 1, end_period: 2 });
    fixture.componentInstance.save();

    expect(api.createDriver).toHaveBeenCalledWith('bv-1', {
      name: 'Licences',
      account_id: 'ac-1',
      cost_center_id: null,
      project_id: null,
      quantity: '4',
      rate: '250',
      spread_method: 'percentage',
      percentages: [25, 75],
      start_period: 1,
      end_period: 2,
      is_active: true,
    });
  });

  it('fills the form from an existing driver and updates it', () => {
    const fixture = TestBed.createComponent(BudgetingDriversComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    fixture.componentInstance.openModal(driver);
    expect(fixture.componentInstance.form.controls.quantity.value).toBe(10);
    fixture.componentInstance.form.patchValue({ quantity: 12 });
    fixture.componentInstance.save();

    expect(api.updateDriver).toHaveBeenCalledWith('dr-1', expect.objectContaining({ quantity: '12', percentages: null }));
  });

  it('generates one driver or all of them and tells the parent', () => {
    const fixture = TestBed.createComponent(BudgetingDriversComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    fixture.componentInstance.generate(driver);
    expect(api.generateDriver).toHaveBeenCalledWith('dr-1');
    expect(translateSpy.instant).toHaveBeenCalledWith('BUDGETING.GENERATED', { lines: 2 });

    fixture.componentInstance.generateAll();
    expect(api.generateDrivers).toHaveBeenCalledWith('bv-1');
    expect(changed).toHaveBeenCalledTimes(2);
  });
});

describe('BudgetingVarianceComponent', () => {
  const api = { getVariance: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getVariance.mockReturnValue(of({ data: variance }));
    configure(api);
  });

  it('loads the variance and reloads it for another grouping and period', () => {
    const fixture = TestBed.createComponent(BudgetingVarianceComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    expect(api.getVariance).toHaveBeenCalledWith('bv-1', 12, 'account');
    fixture.componentInstance.groupBy.set('cost_center');
    fixture.componentInstance.throughPeriod.set(3);
    fixture.componentInstance.load();
    expect(api.getVariance).toHaveBeenLastCalledWith('bv-1', 3, 'cost_center');
    expect(fixture.componentInstance.variance()?.totals.adverse).toBe('100.00');
  });
});

describe('BudgetingVersionDetailComponent', () => {
  const api = {
    getVersion: vi.fn(),
    submitVersion: vi.fn(),
    approveVersion: vi.fn(),
    rejectVersion: vi.fn(),
    lockVersion: vi.fn(),
    getLines: vi.fn(),
    getDrivers: vi.fn(),
    getVariance: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getVersion.mockReturnValue(of({ data: version }));
    api.submitVersion.mockReturnValue(of({ data: version }));
    api.approveVersion.mockReturnValue(of({ data: version }));
    api.rejectVersion.mockReturnValue(of({ data: version }));
    api.lockVersion.mockReturnValue(of({ data: version }));
    api.getLines.mockReturnValue(of({ data: [] }));
    api.getDrivers.mockReturnValue(of({ data: [] }));
    api.getVariance.mockReturnValue(of({ data: variance }));
    configure(api, [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'bv-1' }) } } }]);
  });

  it('loads the version and is editable only as a draft', () => {
    const fixture = TestBed.createComponent(BudgetingVersionDetailComponent);
    fixture.detectChanges();

    expect(api.getVersion).toHaveBeenCalledWith('bv-1');
    expect(fixture.componentInstance.editable()).toBe(true);
    expect(fixture.componentInstance.statusColor()).toBe('default');

    api.getVersion.mockReturnValue(of({ data: { ...version, status: 'locked' } }));
    fixture.componentInstance.reload();
    expect(fixture.componentInstance.editable()).toBe(false);
  });

  it('submits with the comment and sends the reason with a rejection', () => {
    const fixture = TestBed.createComponent(BudgetingVersionDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openStep('submit');
    component.stepForm.patchValue({ comment: ' Please check ' });
    component.runStep();
    expect(api.submitVersion).toHaveBeenCalledWith('bv-1', { comment: 'Please check' });

    component.openStep('reject');
    component.stepForm.patchValue({ comment: 'Too high' });
    component.runStep();
    expect(api.rejectVersion).toHaveBeenCalledWith('bv-1', { comment: 'Too high' });
  });

  it('shows the API reason of a refused approval', () => {
    api.approveVersion.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { status: ['The budget is already approved'] } } })));
    const fixture = TestBed.createComponent(BudgetingVersionDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.openStep('approve');
    fixture.componentInstance.runStep();
    expect(messageSpy.error).toHaveBeenCalledWith('The budget is already approved');
  });
});

describe('BudgetingCompareComponent', () => {
  const comparison = {
    base_version_id: 'bv-1',
    scenario_version_id: 'bv-2',
    through_period: 12,
    group_by: 'account',
    rows: [{ key: 'ac-1', label: 'Rent', code: '6100', base: '1000.00', scenario: '1200.00', delta: '200.00', delta_percent: '20.0' }],
    totals: { base: '1000.00', scenario: '1200.00', delta: '200.00', delta_percent: '20.0' },
  };
  const api = { getVersions: vi.fn(), compareScenarios: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getVersions.mockReturnValue(of({ data: [version, { ...version, id: 'bv-2', name: 'Forecast' }] }));
    api.compareScenarios.mockReturnValue(of({ data: comparison }));
    configure(api);
  });

  it('offers the other versions and compares with the chosen one', () => {
    const fixture = TestBed.createComponent(BudgetingCompareComponent);
    fixture.componentRef.setInput('versionId', 'bv-1');
    fixture.detectChanges();

    expect(fixture.componentInstance.candidates().map((candidate) => candidate.id)).toEqual(['bv-2']);
    expect(api.compareScenarios).not.toHaveBeenCalled();

    fixture.componentInstance.scenarioId.set('bv-2');
    fixture.componentInstance.load();
    expect(api.compareScenarios).toHaveBeenCalledWith('bv-1', 'bv-2', 12, 'account');
    expect(fixture.componentInstance.comparison()?.totals.delta).toBe('200.00');
  });
});
