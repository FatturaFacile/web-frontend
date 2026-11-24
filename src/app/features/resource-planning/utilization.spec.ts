import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ResourcePlanningApiService,
  TranslateService,
  UtilizationReport,
  UtilizationRow,
  UtilizationTarget,
} from '@core';
import { icons } from '../../icons-provider';
import { resources, translateSpy, wrap } from './resource-planning.testing';
import { targetPayload, UtilizationComponent } from './utilization.component';
import { UtilizationStore } from './utilization.store';

const row = (overrides: Partial<UtilizationRow> = {}): UtilizationRow => ({
  key_id: 'e-1',
  key_name: 'Anna Rossi',
  net_available_hours: 160,
  billable_committed_hours: 96,
  billable_booked_hours: 120,
  internal_booked_hours: 16,
  tentative_booked_hours: 24,
  actual_billable_percent: 60,
  forecast_billable_percent: 75,
  target_percent: 70,
  gap_percent: -10,
  status: 'below_target',
  ...overrides,
});

const report: UtilizationReport = {
  from: '2026-03-01',
  to: '2026-03-31',
  group_by: 'resource',
  default_target_percent: 70,
  rows: [
    row(),
    row({
      key_id: 'e-2',
      key_name: 'Bruno Bianchi',
      actual_billable_percent: 72,
      forecast_billable_percent: 80,
      gap_percent: 2,
      status: 'on_target',
    }),
  ],
  totals: row({
    key_id: null,
    key_name: 'Total',
    actual_billable_percent: 66,
    forecast_billable_percent: 77.5,
    gap_percent: -4,
    status: 'on_target',
  }),
};

const targets: UtilizationTarget[] = [
  { id: 't-1', department_id: null, cost_center_id: null, target_percent: 70 },
  { id: 't-2', department_id: 'd-1', cost_center_id: null, target_percent: 80 },
];

describe('targetPayload', () => {
  it('sends both ids as null for the tenant default', () => {
    expect(targetPayload('tenant', 'ignored', 75)).toEqual({
      department_id: null,
      cost_center_id: null,
      target_percent: 75,
    });
  });

  it('sends the id of the scope and null for the other one', () => {
    expect(targetPayload('department', 'd-1', 80)).toEqual({
      department_id: 'd-1',
      cost_center_id: null,
      target_percent: 80,
    });
    expect(targetPayload('cost_center', 'c-1', 60)).toEqual({
      department_id: null,
      cost_center_id: 'c-1',
      target_percent: 60,
    });
  });

  it('refuses a scope without entity and a percentage outside 0 to 100', () => {
    expect(targetPayload('department', null, 80)).toBeNull();
    expect(targetPayload('tenant', null, 101)).toBeNull();
    expect(targetPayload('tenant', null, -1)).toBeNull();
    expect(targetPayload('tenant', null, Number.NaN)).toBeNull();
  });
});

describe('UtilizationStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof UtilizationStore>;

  beforeEach(() => {
    api = {
      getResources: vi.fn(() => of(wrap(resources))),
      getUtilizationReport: vi.fn(() => of(wrap(report))),
      getUtilizationTargets: vi.fn(() => of(wrap(targets))),
      saveUtilizationTarget: vi.fn(() => of(wrap(targets[1]))),
    };
    TestBed.configureTestingModule({
      providers: [UtilizationStore, { provide: ResourcePlanningApiService, useValue: api }],
    });
    store = TestBed.inject(UtilizationStore);
  });

  it('loads the report of the current month grouped by resource, with the targets', async () => {
    await store.init();

    const [from, to, groupBy] = api['getUtilizationReport'].mock.calls[0] as [string, string, string];
    expect(from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(to >= from).toBe(true);
    expect(groupBy).toBe('resource');
    expect(store.rows()).toHaveLength(2);
    expect(store.totals()?.actual_billable_percent).toBe(66);
    expect(store.defaultTarget()).toBe(70);
    expect(store.tenantTarget()?.id).toBe('t-1');
  });

  it('flags the rows below their target and lists the departments and cost centers to pick', async () => {
    await store.init();

    expect(store.belowTarget().map((entry) => entry.key_name)).toEqual(['Anna Rossi']);
    expect(store.departments()).toEqual([
      { id: 'd-1', name: 'Engineering' },
      { id: 'd-2', name: 'Design' },
    ]);
    expect(store.costCenters()).toEqual([{ id: 'c-1', name: 'CC Engineering' }]);
  });

  it('regroups by department and moves the range', async () => {
    await store.init();

    await store.setGroupBy('department');
    expect(api['getUtilizationReport']).toHaveBeenLastCalledWith(
      store.from(),
      store.to(),
      'department',
    );

    await store.setRange('2026-01-01', '2026-03-31');
    expect(api['getUtilizationReport']).toHaveBeenLastCalledWith(
      '2026-01-01',
      '2026-03-31',
      'department',
    );
  });

  it('saves a target and reloads the report', async () => {
    await store.init();
    api['getUtilizationReport'].mockClear();

    const saved = await store.saveTarget({ department_id: 'd-1', target_percent: 80 });

    expect(saved).toBe(true);
    expect(api['saveUtilizationTarget']).toHaveBeenCalledWith({
      department_id: 'd-1',
      target_percent: 80,
    });
    expect(api['getUtilizationReport']).toHaveBeenCalledTimes(1);
    expect(store.saving()).toBe(false);
  });

  it('reports a refused target and a failed load', async () => {
    api['saveUtilizationTarget'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Out of range' } })),
    );
    await store.init();

    expect(await store.saveTarget({ target_percent: 80 })).toBe(false);
    expect(store.error()).toBe('Out of range');

    api['getUtilizationReport'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );
    await store.load();
    expect(store.error()).toBe('resourcePlanning.loadError');
  });
});

describe('UtilizationComponent', () => {
  const messageSpy = { success: vi.fn(), error: vi.fn() };
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getResources: vi.fn(() => of(wrap(resources))),
      getUtilizationReport: vi.fn(() => of(wrap(report))),
      getUtilizationTargets: vi.fn(() => of(wrap(targets))),
      saveUtilizationTarget: vi.fn(() => of(wrap(targets[1]))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ResourcePlanningApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(UtilizationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the totals, a row per resource with actual, forecast, target and status', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent as string;

    expect(fixture.nativeElement.querySelectorAll('nz-statistic')).toHaveLength(5);
    expect(text).toContain('77.5');
    expect(text).toContain('Anna Rossi');
    expect(text).toContain('Bruno Bianchi');
    expect(text).toContain('resourcePlanning.utilization.status.below_target');
    expect(text).toContain('resourcePlanning.utilization.status.on_target');
    expect(text).toContain('160h');
    expect(fixture.nativeElement.querySelectorAll('nz-progress').length).toBe(4);
  });

  it('saves the tenant default target from the editor', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    component.percentValue.set(65);

    await component.saveTarget();

    expect(api['saveUtilizationTarget']).toHaveBeenCalledWith({
      department_id: null,
      cost_center_id: null,
      target_percent: 65,
    });
    expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.utilization.targets.saved');
  });

  it('needs an entity for a department target and offers the departments of the resources', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    component.setScope('department');
    expect(component.payload()).toBeNull();
    expect(component.scopeOptions().map((option) => option.name)).toEqual(['Engineering', 'Design']);

    component.scopeId.set('d-2');
    await component.saveTarget();

    expect(api['saveUtilizationTarget']).toHaveBeenCalledWith({
      department_id: 'd-2',
      cost_center_id: null,
      target_percent: 75,
    });
  });

  it('names the target of a department from the resources', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.targetName(targets[1])).toBe('Engineering');
  });

  it('ignores a range whose start is after its end', async () => {
    const fixture = await render();
    api['getUtilizationReport'].mockClear();

    fixture.componentInstance.setFrom('2999-01-01');

    expect(api['getUtilizationReport']).not.toHaveBeenCalled();
  });
});
