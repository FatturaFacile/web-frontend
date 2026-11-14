import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { EsgInventory, EsgReductionTarget, EsgReportingPeriod, SustainabilityApiService, TranslateService } from '@core';
import { SustainabilityActivityComponent } from './sustainability-activity.component';
import { SustainabilityDashboardComponent } from './sustainability-dashboard.component';
import { SustainabilityTargetsComponent } from './sustainability-targets.component';
import { apiErrorText } from './sustainability.util';

const period: EsgReportingPeriod = {
  id: 'per-1',
  name: 'FY 2027',
  starts_on: '2027-01-01',
  ends_on: '2027-12-31',
  status: 'open',
  revenue: '2000000.00',
  currency: 'EUR',
  employees_fte: '20.00',
};

const inventory: EsgInventory = {
  period: { id: 'per-1', name: 'FY 2027', starts_on: '2027-01-01', ends_on: '2027-12-31', status: 'open' },
  totals: { scope_1_kg: '500.0000', scope_2_kg: '500.0000', scope_3_kg: '1500.0000', total_kg: '2500.0000', total_tco2e: '2.500' },
  scopes: [
    { scope: 1, co2e_kg: '500.0000', tco2e: '0.500', share_percent: '20.00', categories: [{ category: 'stationary_combustion', co2e_kg: '500.0000', share_percent: '20.00', records: 1 }] },
    { scope: 2, co2e_kg: '500.0000', tco2e: '0.500', share_percent: '20.00', categories: [{ category: 'purchased_electricity', co2e_kg: '500.0000', share_percent: '20.00', records: 1 }] },
    { scope: 3, co2e_kg: '1500.0000', tco2e: '1.500', share_percent: '60.00', categories: [{ category: 'business_travel', co2e_kg: '1500.0000', share_percent: '60.00', records: 1 }] },
  ],
  data_quality: { records: 3, estimated_records: 1, estimated_kg: '500.0000', estimated_share_percent: '20.00' },
  intensity: { currency: 'EUR', tco2e_per_million_revenue: '1.250', tco2e_per_fte: '0.125' },
  previous: {
    period_id: 'per-0',
    period_name: 'FY 2026',
    totals: { total_kg: '2000.0000', total_tco2e: '2.000' },
    delta: {
      scope_1: { absolute_kg: '-500.0000', percent: '-50.00' },
      scope_2: { absolute_kg: '0.0000', percent: '0.00' },
      scope_3: { absolute_kg: '1500.0000', percent: null },
      total: { absolute_kg: '500.0000', percent: '25.00' },
    },
  },
};

const target: EsgReductionTarget = {
  id: 'tgt-1',
  name: 'Cut electricity',
  scope: 'scope_2',
  baseline_year: 2025,
  baseline_co2e_kg: '2500.0000',
  target_year: 2030,
  reduction_percent: '40.00',
  status: 'active',
  progress: {
    baseline_co2e_kg: '2500.0000',
    target_co2e_kg: '1500.0000',
    current_year: 2027,
    current_co2e_kg: '1750.0000',
    reduction_achieved_percent: '30.00',
    expected_reduction_percent: '16.00',
    progress_percent: '75.00',
    on_track: true,
  },
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

function configure(api: Record<string, unknown>, component: typeof SustainabilityDashboardComponent | typeof SustainabilityActivityComponent | typeof SustainabilityTargetsComponent): void {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      { provide: SustainabilityApiService, useValue: api },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
    ],
  });
}

describe('SustainabilityDashboardComponent', () => {
  const api = {
    getPeriods: vi.fn(),
    getInventory: vi.fn(),
    createPeriod: vi.fn(),
    closePeriod: vi.fn(),
    reopenPeriod: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getPeriods.mockReturnValue(of({ data: [period] }));
    api.getInventory.mockReturnValue(of({ data: inventory }));
    api.createPeriod.mockReturnValue(of({ data: period }));
    api.closePeriod.mockReturnValue(of({ data: { ...period, status: 'closed' } }));
    configure(api, SustainabilityDashboardComponent);
  });

  it('loads the periods and the inventory of the first one and flattens the categories', () => {
    const fixture = TestBed.createComponent(SustainabilityDashboardComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getInventory).toHaveBeenCalledWith('per-1');
    expect(component.selectedPeriod()?.name).toBe('FY 2027');
    expect(component.categoryRows().map((row) => row.category)).toEqual(['stationary_combustion', 'purchased_electricity', 'business_travel']);
  });

  it('describes the change against the previous period', () => {
    const component = TestBed.createComponent(SustainabilityDashboardComponent).componentInstance;

    expect(component.deltaText({ absolute_kg: '500.0000', percent: '25.00' })).toBe('+25.00%');
    expect(component.deltaText({ absolute_kg: '-500.0000', percent: '-50.00' })).toBe('-50.00%');
    expect(component.deltaText({ absolute_kg: '1500.0000', percent: null })).toBe('+1.50 t');
    expect(component.isUp({ absolute_kg: '-1.0000', percent: '-1.00' })).toBe(false);
  });

  it('creates a period with the API field names and reloads', () => {
    const fixture = TestBed.createComponent(SustainabilityDashboardComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openPeriodModal();
    component.periodForm.patchValue({ name: 'FY 2028', starts_on: '2028-01-01', ends_on: '2028-12-31', revenue: '1000', employees_fte: '' });
    component.savePeriod();

    expect(api.createPeriod).toHaveBeenCalledWith({ name: 'FY 2028', starts_on: '2028-01-01', ends_on: '2028-12-31', revenue: '1000', currency: 'EUR', employees_fte: null });
    expect(messageSpy.success).toHaveBeenCalled();
    expect(component.periodModalVisible()).toBe(false);
  });

  it('shows the validation message of the API when closing fails', () => {
    api.closePeriod.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { status: ['The reporting period is closed'] } } })));
    const fixture = TestBed.createComponent(SustainabilityDashboardComponent);
    fixture.detectChanges();

    fixture.componentInstance.closePeriod(period);

    expect(messageSpy.error).toHaveBeenCalledWith('The reporting period is closed');
  });
});

describe('SustainabilityActivityComponent', () => {
  const api = {
    getActivityRecords: vi.fn(),
    getFactors: vi.fn(),
    createActivityRecord: vi.fn(),
    deleteActivityRecord: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getActivityRecords.mockReturnValue(of({ data: [] }));
    api.getFactors.mockReturnValue(of({ data: [] }));
    api.createActivityRecord.mockReturnValue(of({ data: {} }));
    configure(api, SustainabilityActivityComponent);
  });

  it('offers the units of the activity type and sends the API payload', () => {
    const fixture = TestBed.createComponent(SustainabilityActivityComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    expect(component.unitsOfType()).toEqual(['kWh']);

    component.form.patchValue({ activity_type: 'purchased_goods' });
    expect(component.unitsOfType()).toEqual(['EUR', 'CHF']);
    expect(component.form.controls.unit.value).toBe('EUR');

    component.form.patchValue({ activity_date: '2027-03-10', quantity: '1500', region: 'CH', data_quality: 'estimated' });
    component.save();

    expect(api.createActivityRecord).toHaveBeenCalledWith({
      activity_type: 'purchased_goods',
      activity_date: '2027-03-10',
      quantity: '1500',
      unit: 'EUR',
      region: 'CH',
      data_quality: 'estimated',
      emission_factor_id: null,
      site: null,
      reference: null,
    });
  });
});

describe('SustainabilityTargetsComponent', () => {
  const api = {
    getTargets: vi.fn(),
    createTarget: vi.fn(),
    activateTarget: vi.fn(),
    evaluateTarget: vi.fn(),
    cancelTarget: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTargets.mockReturnValue(of({ data: [target] }));
    api.createTarget.mockReturnValue(of({ data: target }));
    api.evaluateTarget.mockReturnValue(of({ data: { ...target, status: 'achieved' } }));
    configure(api, SustainabilityTargetsComponent);
  });

  it('lists the targets, clamps the progress bar and evaluates an active target', () => {
    const fixture = TestBed.createComponent(SustainabilityTargetsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.targets()).toHaveLength(1);
    expect(component.clamp('175.00')).toBe(100);
    expect(component.clamp('-5')).toBe(0);
    expect(component.clamp(null)).toBe(0);

    component.evaluate(target);
    expect(api.evaluateTarget).toHaveBeenCalledWith('tgt-1');
    expect(api.getTargets).toHaveBeenCalledTimes(2);
  });

  it('creates a target with the reduction percentage as a decimal string', () => {
    const fixture = TestBed.createComponent(SustainabilityTargetsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ name: 'Net zero path', scope: 'total', baseline_year: 2025, target_year: 2030, reduction_percent: '42' });
    component.save();

    expect(api.createTarget).toHaveBeenCalledWith({ name: 'Net zero path', scope: 'total', baseline_year: 2025, target_year: 2030, reduction_percent: '42' });
  });
});

describe('apiErrorText', () => {
  it('prefers the first validation message, then the summary message, then null', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { message: 'Summary', errors: { unit: ['Wrong unit'] } } }))).toBe('Wrong unit');
    expect(apiErrorText(new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } }))).toBe('Forbidden');
    expect(apiErrorText(new HttpErrorResponse({ status: 500 }))).toBeNull();
    expect(apiErrorText('boom')).toBeNull();
  });
});
