import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  PlanningApiService,
  PlanningBalance,
  PlanningCapacity,
  PlanningComparison,
  PlanningDashboard,
  PlanningLine,
  PlanningResource,
  PlanningScenario,
  TranslateService,
} from '@core';
import { PlanningBalanceComponent } from './planning-balance.component';
import { PlanningCapacityComponent } from './planning-capacity.component';
import { PlanningCompareComponent } from './planning-compare.component';
import { PlanningDashboardComponent } from './planning-dashboard.component';
import { PlanningLinesComponent } from './planning-lines.component';
import { PlanningResourcesComponent } from './planning-resources.component';
import { PlanningScenarioDetailComponent } from './planning-scenario-detail.component';
import { PlanningScenariosComponent } from './planning-scenarios.component';
import { apiErrorText, blankToNull, decimalOrNull, monthLabel, monthStartIso } from './planning.util';

const scenario: PlanningScenario = {
  id: 'sc-1',
  name: 'Baseline 2028',
  description: null,
  scenario_type: 'baseline',
  base_scenario_id: null,
  status: 'draft',
  horizon_start: '2028-01-01',
  horizon_end: '2028-06-30',
  submitted_by: null,
  submitted_at: null,
  approved_by: null,
  approved_at: null,
  locked_by: null,
  locked_at: null,
  published_version: 0,
  published_at: null,
  lines_count: 2,
  approvals: [],
};

const line: PlanningLine = {
  id: 'ln-1',
  scenario_id: 'sc-1',
  line_type: 'demand',
  item_id: null,
  item_code: 'P-1',
  item_name: 'Widget',
  period: '2028-02-01',
  quantity: '100.000',
  source: 'manual',
  notes: null,
};

const resource: PlanningResource = {
  id: 'rs-1',
  code: 'ASM',
  name: 'Assembly',
  work_center_id: null,
  unit: 'hours',
  default_capacity: '160.000',
  is_active: true,
  rates: [{ id: 'rt-1', resource_id: 'rs-1', item_code: 'P-1', load_per_unit: '0.50000' }],
};

const totals = { total_demand: '100.000', total_supply: '60.000', total_gap: '-40.000', shortage_items: 1, surplus_items: 0, max_shortage: '40.000' };
const capacitySummary = { feasible: false, overloaded_count: 1, max_utilization_percent: '150.0', resources: 1 };

const balance: PlanningBalance = {
  scenario_id: 'sc-1',
  carry_over: true,
  periods: ['2028-01-01'],
  items: [
    {
      item_code: 'P-1',
      item_name: 'Widget',
      total_demand: '100.000',
      total_supply: '60.000',
      total_gap: '-40.000',
      ending_gap: '-40.000',
      max_shortage: '40.000',
      shortage_periods: 1,
      periods: [{ period: '2028-01-01', demand: '100.000', supply: '60.000', gap: '-40.000', balance: '-40.000', status: 'shortage' }],
    },
  ],
  totals,
};

const capacity: PlanningCapacity = {
  scenario_id: 'sc-1',
  periods: ['2028-01-01'],
  rows: [
    { resource_id: 'rs-1', resource_code: 'ASM', resource_name: 'Assembly', unit: 'hours', period: '2028-01-01', load: '150.000', available: '100.000', source: 'default', utilization_percent: '150.0', overload: '50.000', is_overloaded: true },
  ],
  summary: capacitySummary,
};

const dashboard: PlanningDashboard = {
  scenarios: { total: 1, by_status: { draft: 1, review: 0, approved: 0, locked: 0 } },
  pending_approval: [],
  current_publication: null,
  selected_scenario: { id: 'sc-1', name: 'Baseline 2028', status: 'draft', scenario_type: 'baseline' },
  totals,
  top_gaps: [{ item_code: 'P-1', item_name: 'Widget', total_gap: '-40.000', ending_gap: '-40.000', max_shortage: '40.000', shortage_periods: 1 }],
  capacity: { summary: capacitySummary, resources: [] },
};

const comparison: PlanningComparison = {
  base: { id: 'sc-1', name: 'Baseline 2028', status: 'draft', totals, capacity: capacitySummary },
  other: { id: 'sc-2', name: 'Demand +20%', status: 'draft', totals, capacity: capacitySummary },
  delta: { total_demand: '20.000', total_supply: '0.000', total_gap: '-20.000', overloaded_periods: 0 },
  items: [],
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

function configure(api: Record<string, unknown>, extra: unknown[] = []): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PlanningApiService, useValue: api },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
      ...(extra as never[]),
    ],
  });
}

describe('planning util', () => {
  it('reads the first validation message of a 422', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { period: ['Outside the horizon'] } } }))).toBe('Outside the horizon');
    expect(apiErrorText(new HttpErrorResponse({ status: 500, error: { message: 'Server error' } }))).toBe('Server error');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('turns blanks into null and numbers into API strings', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull(' P-1 ')).toBe('P-1');
    expect(decimalOrNull(null)).toBeNull();
    expect(decimalOrNull(12.5)).toBe('12.5');
  });

  it('labels a period by its month and finds the first day of a month', () => {
    expect(monthLabel('2028-02-01')).toBe('2028-02');
    expect(monthStartIso()).toMatch(/^\d{4}-\d{2}-01$/);
    expect(monthStartIso(11)).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe('PlanningDashboardComponent', () => {
  const api = { getDashboard: vi.fn(), getScenarios: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDashboard.mockReturnValue(of({ data: dashboard }));
    api.getScenarios.mockReturnValue(of({ data: [scenario] }));
    configure(api);
  });

  it('loads the dashboard and reloads it for a chosen scenario', () => {
    const fixture = TestBed.createComponent(PlanningDashboardComponent);
    fixture.detectChanges();

    expect(api.getDashboard).toHaveBeenCalledWith(undefined);
    expect(fixture.componentInstance.dashboard()?.top_gaps).toHaveLength(1);

    fixture.componentInstance.selectScenario('sc-1');
    expect(api.getDashboard).toHaveBeenLastCalledWith('sc-1');
  });

  it('shows the reason of a failed load', () => {
    api.getDashboard.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })));
    const fixture = TestBed.createComponent(PlanningDashboardComponent);
    fixture.detectChanges();

    expect(messageSpy.error).toHaveBeenCalledWith('Forbidden');
  });
});

describe('PlanningScenariosComponent', () => {
  const api = { getScenarios: vi.fn(), createScenario: vi.fn(), copyScenario: vi.fn(), deleteScenario: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getScenarios.mockReturnValue(of({ data: [scenario] }));
    api.createScenario.mockReturnValue(of({ data: scenario }));
    api.copyScenario.mockReturnValue(of({ data: { ...scenario, id: 'sc-2' } }));
    api.deleteScenario.mockReturnValue(of(undefined));
    configure(api);
  });

  it('filters the scenarios by status and type', () => {
    const fixture = TestBed.createComponent(PlanningScenariosComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getScenarios).toHaveBeenCalledWith({ status: undefined, scenario_type: undefined, per_page: 100 });
    component.status.set('review');
    component.type.set('what_if');
    component.load();
    expect(api.getScenarios).toHaveBeenLastCalledWith({ status: 'review', scenario_type: 'what_if', per_page: 100 });
  });

  it('proposes a what-if scenario once a baseline exists and creates with the API field names', () => {
    const fixture = TestBed.createComponent(PlanningScenariosComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCreate();
    expect(component.createForm.controls.scenario_type.value).toBe('what_if');

    component.createForm.patchValue({ name: 'Peak season', horizon_start: '2028-01-01', horizon_end: '2028-12-01', description: '  ' });
    component.saveCreate();

    expect(api.createScenario).toHaveBeenCalledWith({ name: 'Peak season', description: null, scenario_type: 'what_if', horizon_start: '2028-01-01', horizon_end: '2028-12-01' });
    expect(component.createVisible()).toBe(false);
  });

  it('copies a scenario with the percentage adjustments', () => {
    const fixture = TestBed.createComponent(PlanningScenariosComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCopy(scenario);
    component.copyForm.patchValue({ name: 'Demand +20%', demand_adjustment_percent: 20, supply_adjustment_percent: null });
    component.saveCopy();

    expect(api.copyScenario).toHaveBeenCalledWith('sc-1', { name: 'Demand +20%', demand_adjustment_percent: 20, supply_adjustment_percent: null });
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('rejects an adjustment below minus one hundred per cent', () => {
    const fixture = TestBed.createComponent(PlanningScenariosComponent);
    fixture.detectChanges();

    fixture.componentInstance.openCopy(scenario);
    fixture.componentInstance.copyForm.patchValue({ name: 'Bad', demand_adjustment_percent: -150 });
    expect(fixture.componentInstance.copyForm.valid).toBe(false);
  });

  it('deletes a scenario or shows the error', () => {
    const fixture = TestBed.createComponent(PlanningScenariosComponent);
    fixture.detectChanges();

    fixture.componentInstance.remove(scenario);
    expect(api.deleteScenario).toHaveBeenCalledWith('sc-1');

    api.deleteScenario.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { status: ['Only a draft scenario can be changed'] } } })));
    fixture.componentInstance.remove(scenario);
    expect(messageSpy.error).toHaveBeenCalledWith('Only a draft scenario can be changed');
  });
});

describe('PlanningLinesComponent', () => {
  const api = { getLines: vi.fn(), saveLine: vi.fn(), updateLine: vi.fn(), deleteLine: vi.fn(), importForecasts: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getLines.mockReturnValue(of({ data: [line] }));
    api.saveLine.mockReturnValue(of({ data: line }));
    api.updateLine.mockReturnValue(of({ data: line }));
    api.deleteLine.mockReturnValue(of(undefined));
    api.importForecasts.mockReturnValue(of({ data: { created: 2, updated: 0, skipped: 1 } }));
    configure(api);
  });

  it('loads the lines of the scenario and filters by side', () => {
    const fixture = TestBed.createComponent(PlanningLinesComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.detectChanges();

    expect(api.getLines).toHaveBeenCalledWith('sc-1', { line_type: undefined, per_page: 100 });
    fixture.componentInstance.lineType.set('supply');
    fixture.componentInstance.load();
    expect(api.getLines).toHaveBeenLastCalledWith('sc-1', { line_type: 'supply', per_page: 100 });
  });

  it('saves a new line with the API field names and tells the parent', () => {
    const fixture = TestBed.createComponent(PlanningLinesComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    fixture.componentInstance.openModal();
    fixture.componentInstance.form.patchValue({ line_type: 'supply', period: '2028-03-15', item_code: 'P-2', item_name: ' ', quantity: 40, notes: '' });
    fixture.componentInstance.save();

    expect(api.saveLine).toHaveBeenCalledWith('sc-1', { line_type: 'supply', item_code: 'P-2', item_name: null, period: '2028-03-15', quantity: '40', notes: null });
    expect(changed).toHaveBeenCalled();
  });

  it('updates an existing line instead of creating one', () => {
    const fixture = TestBed.createComponent(PlanningLinesComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.detectChanges();

    fixture.componentInstance.openModal(line);
    expect(fixture.componentInstance.form.controls.quantity.value).toBe(100);
    fixture.componentInstance.form.patchValue({ quantity: 120 });
    fixture.componentInstance.save();

    expect(api.updateLine).toHaveBeenCalledWith('ln-1', expect.objectContaining({ item_code: 'P-1', quantity: '120' }));
    expect(api.saveLine).not.toHaveBeenCalled();
  });

  it('imports the forecasts and reports the result', () => {
    const fixture = TestBed.createComponent(PlanningLinesComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.detectChanges();

    fixture.componentInstance.importForecasts(true);
    expect(api.importForecasts).toHaveBeenCalledWith('sc-1', true);
    expect(translateSpy.instant).toHaveBeenCalledWith('PLANNING.IMPORT_DONE', { created: 2, updated: 0, skipped: 1 });
  });

  it('removes a line and shows an error when the scenario is no longer a draft', () => {
    const fixture = TestBed.createComponent(PlanningLinesComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.detectChanges();

    fixture.componentInstance.remove(line);
    expect(api.deleteLine).toHaveBeenCalledWith('ln-1');

    api.deleteLine.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Locked' } })));
    fixture.componentInstance.remove(line);
    expect(messageSpy.error).toHaveBeenCalledWith('Locked');
  });
});

describe('PlanningBalanceComponent', () => {
  const api = { getBalance: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getBalance.mockReturnValue(of({ data: balance }));
    configure(api);
  });

  it('loads the balance with carry-over and without it', () => {
    const fixture = TestBed.createComponent(PlanningBalanceComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.detectChanges();

    expect(api.getBalance).toHaveBeenCalledWith('sc-1', true);
    fixture.componentInstance.carryOver.set(false);
    fixture.componentInstance.load();
    expect(api.getBalance).toHaveBeenLastCalledWith('sc-1', false);
    expect(fixture.componentInstance.statusColor('shortage')).toBe('red');
  });
});

describe('PlanningCapacityComponent', () => {
  const api = { getCapacity: vi.fn(), getConstraints: vi.fn(), getResources: vi.fn(), saveConstraint: vi.fn(), deleteConstraint: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCapacity.mockReturnValue(of({ data: capacity }));
    api.getConstraints.mockReturnValue(of({ data: [] }));
    api.getResources.mockReturnValue(of({ data: [resource] }));
    api.saveConstraint.mockReturnValue(of({ data: {} }));
    api.deleteConstraint.mockReturnValue(of(undefined));
    configure(api);
  });

  it('loads the capacity check, the constraints and the resources', () => {
    const fixture = TestBed.createComponent(PlanningCapacityComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.detectChanges();

    expect(fixture.componentInstance.capacity()?.summary.feasible).toBe(false);
    expect(fixture.componentInstance.resources()).toHaveLength(1);
  });

  it('saves a constraint with the API field names', () => {
    const fixture = TestBed.createComponent(PlanningCapacityComponent);
    fixture.componentRef.setInput('scenarioId', 'sc-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();

    fixture.componentInstance.openModal();
    fixture.componentInstance.form.patchValue({ resource_id: 'rs-1', period: '2028-02-01', available_capacity: 120, notes: '' });
    fixture.componentInstance.save();

    expect(api.saveConstraint).toHaveBeenCalledWith('sc-1', { resource_id: 'rs-1', period: '2028-02-01', available_capacity: '120', notes: null });
  });
});

describe('PlanningScenarioDetailComponent', () => {
  const api = {
    getScenario: vi.fn(),
    submitScenario: vi.fn(),
    approveScenario: vi.fn(),
    rejectScenario: vi.fn(),
    lockScenario: vi.fn(),
    publishScenario: vi.fn(),
    getLines: vi.fn(),
    getBalance: vi.fn(),
    getCapacity: vi.fn(),
    getConstraints: vi.fn(),
    getResources: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getScenario.mockReturnValue(of({ data: { ...scenario, status: 'review' } }));
    api.submitScenario.mockReturnValue(of({ data: scenario }));
    api.approveScenario.mockReturnValue(of({ data: scenario }));
    api.rejectScenario.mockReturnValue(of({ data: scenario }));
    api.lockScenario.mockReturnValue(of({ data: scenario }));
    api.publishScenario.mockReturnValue(of({ data: {} }));
    api.getLines.mockReturnValue(of({ data: [] }));
    api.getBalance.mockReturnValue(of({ data: balance }));
    api.getCapacity.mockReturnValue(of({ data: capacity }));
    api.getConstraints.mockReturnValue(of({ data: [] }));
    api.getResources.mockReturnValue(of({ data: [] }));
    configure(api, [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'sc-1' }) } } }]);
  });

  it('loads the scenario and is read-only once it left the draft', () => {
    const fixture = TestBed.createComponent(PlanningScenarioDetailComponent);
    fixture.detectChanges();

    expect(api.getScenario).toHaveBeenCalledWith('sc-1');
    expect(fixture.componentInstance.editable()).toBe(false);
    expect(fixture.componentInstance.statusColor()).toBe('orange');
  });

  it('approves with the overload acceptance and the comment', () => {
    const fixture = TestBed.createComponent(PlanningScenarioDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openAction('approve');
    component.actionForm.patchValue({ comment: ' Overtime approved ', accept_overload: true });
    component.runAction();

    expect(api.approveScenario).toHaveBeenCalledWith('sc-1', { comment: 'Overtime approved', accept_overload: true });
    expect(component.actionVisible()).toBe(false);
  });

  it('sends the reason with a rejection and publishes without extra fields', () => {
    const fixture = TestBed.createComponent(PlanningScenarioDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openAction('reject');
    component.actionForm.patchValue({ comment: 'Demand too low' });
    component.runAction();
    expect(api.rejectScenario).toHaveBeenCalledWith('sc-1', { comment: 'Demand too low' });

    component.openAction('publish');
    component.runAction();
    expect(api.publishScenario).toHaveBeenCalledWith('sc-1', { comment: null });
  });

  it('shows the capacity overload message of a refused approval', () => {
    api.approveScenario.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { accept_overload: ['1 resource months are overloaded'] } } })));
    const fixture = TestBed.createComponent(PlanningScenarioDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.openAction('approve');
    fixture.componentInstance.runAction();
    expect(messageSpy.error).toHaveBeenCalledWith('1 resource months are overloaded');
  });
});

describe('PlanningCompareComponent', () => {
  const api = { getScenarios: vi.fn(), compareScenarios: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getScenarios.mockReturnValue(of({ data: [scenario, { ...scenario, id: 'sc-2' }] }));
    api.compareScenarios.mockReturnValue(of({ data: comparison }));
    configure(api);
  });

  it('compares the two chosen scenarios', () => {
    const fixture = TestBed.createComponent(PlanningCompareComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.baseId.set('sc-1');
    component.otherId.set('sc-2');
    component.compare();

    expect(api.compareScenarios).toHaveBeenCalledWith('sc-1', 'sc-2');
    expect(component.sides()).toHaveLength(2);
  });

  it('does nothing until both scenarios are chosen', () => {
    const fixture = TestBed.createComponent(PlanningCompareComponent);
    fixture.detectChanges();

    fixture.componentInstance.baseId.set('sc-1');
    fixture.componentInstance.compare();
    expect(api.compareScenarios).not.toHaveBeenCalled();
  });
});

describe('PlanningResourcesComponent', () => {
  const api = { getResources: vi.fn(), createResource: vi.fn(), updateResource: vi.fn(), deleteResource: vi.fn(), createRate: vi.fn(), updateRate: vi.fn(), deleteRate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getResources.mockReturnValue(of({ data: [resource] }));
    api.createResource.mockReturnValue(of({ data: resource }));
    api.updateResource.mockReturnValue(of({ data: resource }));
    api.createRate.mockReturnValue(of({ data: resource.rates?.[0] }));
    api.updateRate.mockReturnValue(of({ data: resource.rates?.[0] }));
    api.deleteRate.mockReturnValue(of(undefined));
    api.deleteResource.mockReturnValue(of(undefined));
    configure(api);
  });

  it('creates a resource with the API field names', () => {
    const fixture = TestBed.createComponent(PlanningResourcesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openResource();
    component.resourceForm.patchValue({ code: 'PAINT', name: 'Paint shop', unit: 'hours', default_capacity: 200, is_active: true });
    component.saveResource();

    expect(api.createResource).toHaveBeenCalledWith({ code: 'PAINT', name: 'Paint shop', work_center_id: null, unit: 'hours', default_capacity: '200', is_active: true });
  });

  it('adds and edits the load of an item on a resource', () => {
    const fixture = TestBed.createComponent(PlanningResourcesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRate(resource);
    component.rateForm.patchValue({ item_code: 'P-2', load_per_unit: 0.25 });
    component.saveRate();
    expect(api.createRate).toHaveBeenCalledWith('rs-1', { item_code: 'P-2', load_per_unit: '0.25' });

    component.openRate(resource, resource.rates?.[0]);
    expect(component.rateForm.controls.load_per_unit.value).toBe(0.5);
    component.rateForm.patchValue({ load_per_unit: 0.75 });
    component.saveRate();
    expect(api.updateRate).toHaveBeenCalledWith('rt-1', { item_code: 'P-1', load_per_unit: '0.75' });
  });

  it('refuses a zero load per unit', () => {
    const fixture = TestBed.createComponent(PlanningResourcesComponent);
    fixture.detectChanges();

    fixture.componentInstance.openRate(resource);
    fixture.componentInstance.rateForm.patchValue({ item_code: 'P-3', load_per_unit: 0 });
    expect(fixture.componentInstance.rateForm.valid).toBe(false);
  });
});
