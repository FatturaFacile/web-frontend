import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeneralLedgerApiService, ManufacturingApiService, ManufacturingProductionApiService, MfgOeeResult, TranslateService } from '@core';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { OeeDashboardComponent } from './oee-dashboard.page';
import { RoutingDesignerComponent } from './routing-designer.page';
import { WorkCentersComponent } from './work-centers.page';
import { WorkingCalendarsComponent } from './working-calendars.page';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const page = <T>(data: T[]) => of({ success: true, message: '', data, meta: { current_page: 1, from: 1, last_page: 1, per_page: 15, to: data.length, total: data.length } });
const q = (f: ComponentFixture<unknown>, id: string): HTMLElement | null => (f.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
const qa = (f: ComponentFixture<unknown>, sel: string): HTMLElement[] => Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel));

async function settle(f: ComponentFixture<unknown>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

async function settleFake(f: ComponentFixture<unknown>, ms = 0): Promise<void> {
  f.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  f.detectChanges();
}

function cleanupTestBed(f: ComponentFixture<unknown> | undefined): void {
  f?.destroy();
  document.querySelectorAll('.cdk-overlay-container').forEach((el) => {
    el.innerHTML = '';
  });
  vi.useRealTimers();
  TestBed.resetTestingModule();
}

function setup(api: Record<string, unknown>): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideNzIcons(icons),
      provideNzI18n(en_US),
      provideNzDateFnsAdapter(),
      {
        provide: TranslateService,
        useValue: {
          currentLanguage: signal('en'),
          translate: (key: string) => key,
          instant: (key: string) => key,
        },
      },
      { provide: ManufacturingProductionApiService, useValue: api },
      { provide: GeneralLedgerApiService, useValue: { getCostCenters: () => page([{ id: 'cc1', code: 'CC1', name: 'Turning', is_active: true }]) } },
      { provide: ManufacturingApiService, useValue: { getMfgItems: () => page([{ id: 'item-1', item_code: 'FG-1', name: 'Shaft' }]) } },
    ] as never,
  });
}

const CENTERS = [
  { id: 'w1', work_center_code: 'WC1', name: 'Turning', status: 'active', capacity_hours_per_day: '8.00', efficiency_rate: '95.00', availability_rate: '90.00', hourly_cost_rate: '30.00', hourly_overhead_rate: '10.00', hourly_setup_cost_rate: '40.00', hourly_machine_run_cost_rate: '60.00', currency_code: 'CHF', parallel_capacity_units: 2, oee_target_percent: '85.00', default_queue_wait_minutes: 0, default_move_time_minutes: 0, alternate_work_center_ids: [], parent_work_center_id: null },
  { id: 'w2', work_center_code: 'WC2', name: 'Milling', status: 'maintenance', capacity_hours_per_day: '8.00', efficiency_rate: '100.00', availability_rate: '100.00', hourly_cost_rate: '0', hourly_overhead_rate: '0', hourly_setup_cost_rate: '0', hourly_machine_run_cost_rate: '0', currency_code: 'CHF', parallel_capacity_units: 1, oee_target_percent: '80.00', default_queue_wait_minutes: 0, default_move_time_minutes: 0, alternate_work_center_ids: [], parent_work_center_id: 'w1' },
];
const MACHINES = [
  { id: 'm1', machine_code: 'CNC-1', name: 'CNC lathe', work_center_id: 'w1', status: 'active', is_industria_40_enabled: true, is_transizione_50_enabled: true, parallel_capacity_units: 1, has_telemetry_endpoint_key: false },
];

describe('WorkCentersComponent', () => {
  const api = {
    listWorkCenters: vi.fn(() => page(CENTERS)),
    listMachines: vi.fn(() => page(MACHINES)),
    listWorkingCalendars: vi.fn(() => page([])),
    createWorkCenter: vi.fn(() => ok({ id: 'w3' })),
    updateWorkCenter: vi.fn(() => ok({ id: 'w1' })),
    createMachine: vi.fn(() => ok({ id: 'm2' })),
  };
  let fixture: ComponentFixture<WorkCentersComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setup(api);
    fixture = TestBed.createComponent(WorkCentersComponent);
    await settle(fixture);
  });

  afterEach(() => cleanupTestBed(fixture));

  it('shows the centres as a tree with the Industria 4.0 / Transizione 5.0 badges', () => {
    expect(q(fixture, 'center-WC1')).not.toBeNull();
    expect(q(fixture, 'center-WC2')).not.toBeNull();
    expect(q(fixture, 'badge-i40')?.textContent).toContain('1');
    expect(q(fixture, 'badge-t50')?.textContent).toContain('1');
    // WC2 is a child of WC1, so it is listed right after it.
    const codes = qa(fixture, '[data-testid^="center-WC"]').map((row) => row.getAttribute('data-testid'));
    expect(codes).toEqual(['center-WC1', 'center-WC2']);
  });

  it('opens the drawer with the current values and saves the changes', async () => {
    (fixture.componentInstance as unknown as { openCenter(c: unknown): void }).openCenter(CENTERS[0]);
    await settle(fixture);

    const component = fixture.componentInstance as unknown as { patchCenter(p: object): void; saveCenter(): void; editingCenterId(): string | null };
    expect(component.editingCenterId()).toBe('w1');

    component.patchCenter({ oee_target_percent: 90, parallel_capacity_units: 3, hourly_setup_cost_rate: 55 });
    component.saveCenter();

    expect(api.updateWorkCenter).toHaveBeenCalledWith('w1', expect.objectContaining({ oee_target_percent: 90, parallel_capacity_units: 3, hourly_setup_cost_rate: 55, work_center_code: 'WC1' }));
  });

  it('creates a new work centre with the code and name', async () => {
    (q(fixture, 'new-center') as HTMLButtonElement).click();
    await settle(fixture);
    const component = fixture.componentInstance as unknown as { patchCenter(p: object): void; saveCenter(): void };

    component.patchCenter({ work_center_code: 'WC9', name: 'Grinding' });
    component.saveCenter();

    expect(api.createWorkCenter).toHaveBeenCalledWith(expect.objectContaining({ work_center_code: 'WC9', name: 'Grinding', status: 'active', description: null }));
  });
});

describe('WorkingCalendarsComponent', () => {
  const calendar = { id: 'c1', code: 'STD', name: 'Standard', timezone: 'Europe/Zurich', country_code: 'CH', is_default: true, shifts: [{ day_of_week: 1, shift_code: 'D', start_time: '08:00:00', end_time: '17:00:00' }], closures: [] };
  const api = {
    listWorkingCalendars: vi.fn(() => page([calendar])),
    getWorkingCalendar: vi.fn(() => ok(calendar)),
    previewCalendarDays: vi.fn(() =>
      ok([
        { date: '2026-12-24', day_type: 'working_shift', label: null, available_minutes: 480, shifts: [] },
        { date: '2026-12-25', day_type: 'holiday', label: 'Christmas', available_minutes: 0, shifts: [] },
        { date: '2026-12-26', day_type: 'holiday', label: 'St. Stephen', available_minutes: 0, shifts: [] },
        { date: '2026-12-27', day_type: 'non_working_weekend', label: null, available_minutes: 0, shifts: [] },
        { date: '2026-12-28', day_type: 'planned_shutdown', label: 'Inventory', available_minutes: 0, shifts: [] },
      ]),
    ),
    createWorkingCalendar: vi.fn(() => ok({ id: 'c2' })),
    updateWorkingCalendar: vi.fn(() => ok(calendar)),
  };
  let fixture: ComponentFixture<WorkingCalendarsComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setup(api);
    fixture = TestBed.createComponent(WorkingCalendarsComponent);
    await settle(fixture);
  });

  afterEach(() => cleanupTestBed(fixture));

  it('previews the days of the selected calendar with their type', async () => {
    q(fixture, 'cal-STD')?.click();
    await settle(fixture);

    expect(api.getWorkingCalendar).toHaveBeenCalledWith('c1');
    expect(api.previewCalendarDays).toHaveBeenCalled();
    expect(q(fixture, 'day-2026-12-24')?.getAttribute('data-type')).toBe('working_shift');
    expect(q(fixture, 'day-2026-12-25')?.getAttribute('data-type')).toBe('holiday');
    expect(q(fixture, 'day-2026-12-27')?.getAttribute('data-type')).toBe('non_working_weekend');
    expect(q(fixture, 'day-2026-12-28')?.getAttribute('data-type')).toBe('planned_shutdown');
    expect(q(fixture, 'totals')).not.toBeNull();
  });

  it('saves the shifts with HH:mm times', async () => {
    q(fixture, 'cal-STD')?.click();
    await settle(fixture);
    (q(fixture, 'save-calendar') as HTMLButtonElement).click();

    expect(api.updateWorkingCalendar).toHaveBeenCalledWith('c1', expect.objectContaining({ code: 'STD', shifts: [expect.objectContaining({ start_time: '08:00', end_time: '17:00' })] }));
  });
});

describe('RoutingDesignerComponent', () => {
  const routing = {
    id: 'r1',
    routing_number: 'RT-1',
    mfg_item_id: 'item-1',
    item_code: 'FG-1',
    item_name: 'Shaft',
    name: 'Shaft routing',
    revision: 'A',
    status: 'active',
    is_default: true,
    operations: [
      { id: 'o1', sequence: 10, operation_code: 'OP10', name: 'Turn', work_center_id: 'w1', operation_type: 'internal_machining', setup_time_minutes: '10', run_time_minutes_per_unit: '2' },
      { id: 'o2', sequence: 20, operation_code: 'OP20', name: 'Mill', work_center_id: 'w2', operation_type: 'manual_assembly', setup_time_minutes: '5', run_time_minutes_per_unit: '1' },
    ],
  };
  const simulation = {
    routing_id: 'r1',
    quantity: '10',
    include_overlap: true,
    lead_time: { total_minutes: '120', serial_minutes: '150', overlap_saving_minutes: '30', calendar: null },
    steps: [
      { operation_id: 'o1', operation_seq: 10, operation_code: 'OP10', start_offset_minutes: '0', end_offset_minutes: '80', overlap_applied: true, duration_minutes: '80' },
      { operation_id: 'o2', operation_seq: 20, operation_code: 'OP20', start_offset_minutes: '60', end_offset_minutes: '120', overlap_applied: false, duration_minutes: '60' },
    ],
    cost: { total: '500', unit: '50', setup: '10', machine_run: '200', direct_labor: '150', overhead: '100', subcontracting: '0', material: '40' },
  };
  const api = {
    listRoutings: vi.fn(() => page([routing])),
    listWorkCenters: vi.fn(() => page(CENTERS)),
    listMachines: vi.fn(() => page(MACHINES)),
    getRouting: vi.fn(() => ok(routing)),
    updateRouting: vi.fn(() => ok(routing)),
    createRouting: vi.fn(() => ok({ ...routing, id: 'r2' })),
    cloneRoutingRevision: vi.fn(() => ok({ ...routing, id: 'r3', revision: 'B' })),
    calculateRouting: vi.fn(() => ok(simulation)),
  };
  let fixture: ComponentFixture<RoutingDesignerComponent>;
  interface Internals {
    open(id: string): void;
    move(i: number, d: -1 | 1): void;
    addOp(): void;
    save(): void;
    clone(): void;
    setSim(c: object): void;
    patchOp(p: object): void;
    draft(): { operations: { operation_code: string }[] } | null;
  }
  const internals = (): Internals => fixture.componentInstance as unknown as Internals;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    setup(api);
    fixture = TestBed.createComponent(RoutingDesignerComponent);
    await settleFake(fixture);
    internals().open('r1');
    await settleFake(fixture, 350);
  });

  afterEach(() => cleanupTestBed(fixture));

  it('loads the operations as an ordered flow and simulates the saved routing', () => {
    expect(qa(fixture, '[data-testid="flow"] li')).toHaveLength(2);
    expect(api.calculateRouting).toHaveBeenCalledWith('r1', expect.objectContaining({ quantity: 1, include_overlap: true }));
    expect(q(fixture, 'sim-total')?.textContent).toContain('120');
    expect(q(fixture, 'sim-cost')?.textContent).toContain('500.00');
    expect(qa(fixture, '[data-testid="gantt"] .bar-fill')).toHaveLength(2);
  });

  it('re-runs the simulation, debounced, when the quantity or overlap changes', async () => {
    api.calculateRouting.mockClear();
    internals().setSim({ quantity: 50 });
    internals().setSim({ overlap: false });
    await settleFake(fixture, 350);

    expect(api.calculateRouting).toHaveBeenCalledTimes(1);
    expect(api.calculateRouting).toHaveBeenCalledWith('r1', expect.objectContaining({ quantity: 50, include_overlap: false }));
  });

  it('reorders operations and saves them with renumbered sequences', async () => {
    internals().move(0, 1);
    await settleFake(fixture);
    expect(internals().draft()?.operations.map((o) => o.operation_code)).toEqual(['OP20', 'OP10']);
    expect(q(fixture, 'sim-dirty')).not.toBeNull();

    internals().save();

    const [, payload] = api.updateRouting.mock.calls[0] as unknown as [string, { operations: { operation_code: string; sequence: number }[] }];
    expect(payload.operations.map((o) => [o.operation_code, o.sequence])).toEqual([['OP20', 10], ['OP10', 20]]);
  });

  it('clones the routing as a new revision', async () => {
    internals().clone();
    await settleFake(fixture);

    expect(api.cloneRoutingRevision).toHaveBeenCalledWith('r1', undefined);
    expect(api.getRouting).toHaveBeenCalledTimes(1);
  });
});

describe('OeeDashboardComponent', () => {
  const result: MfgOeeResult = {
    work_center_id: 'w1',
    machine_center_id: null,
    from: '2026-12-01T00:00:00Z',
    to: '2026-12-08T00:00:00Z',
    granularity: 'daily',
    summary: { scheduled_minutes: 480, planned_production_minutes: 450, unplanned_downtime_minutes: 50, operating_minutes: 400, good_units: 90, scrap_units: 5, rework_units: 0, total_units: 95, availability_percent: 88.9, performance_percent: 80, quality_percent: 94.7, oee_percent: 67.4 },
    targets_percent: { oee: 85, availability: 90, performance: null, quality: 90 },
    meets_target: false,
    gap_to_target_percent: -17.6,
    six_big_losses: {
      equipment_failure: { minutes: 40, factor: 'availability' },
      setup_adjustment: { minutes: 10, factor: 'availability' },
      minor_stops: { minutes: 0, factor: 'performance' },
      reduced_speed: { minutes: 0, factor: 'performance' },
      process_defects: { minutes: 5, factor: 'quality' },
      startup_rejects: { minutes: 0, factor: 'quality' },
    },
    series: [{ from: '2026-12-01T00:00:00Z', to: '2026-12-02T00:00:00Z', oee_percent: 70 } as never],
    machines: [{ machine_center_id: 'm1', machine_code: 'CNC-1', industria_40: true, transizione_50: false, telemetry_status: 'stale', telemetry_last_seen_at: '2026-12-01T10:00:00Z' }],
  };
  const api = {
    listWorkCenters: vi.fn(() => page(CENTERS)),
    listMachines: vi.fn(() => page(MACHINES)),
    oeeSummary: vi.fn(() => ok({ ...result, series: undefined })),
    oeeTimeseries: vi.fn(() => ok(result)),
  };
  let fixture: ComponentFixture<OeeDashboardComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setup(api);
    fixture = TestBed.createComponent(OeeDashboardComponent);
    await settle(fixture);
  });

  afterEach(() => cleanupTestBed(fixture));

  it('queries the summary and the time series of the first work centre', () => {
    expect(api.oeeSummary).toHaveBeenCalledWith(expect.objectContaining({ work_center_id: 'w1', granularity: 'daily' }));
    expect(api.oeeTimeseries).toHaveBeenCalledTimes(1);
  });

  it('colours the KPI cards against the targets', () => {
    expect(q(fixture, 'kpi-OEE')?.getAttribute('data-status')).toBe('bad');
    expect(q(fixture, 'kpi-AVAILABILITY')?.getAttribute('data-status')).toBe('warn');
    expect(q(fixture, 'kpi-PERFORMANCE')?.getAttribute('data-status')).toBe('none');
    expect(q(fixture, 'kpi-QUALITY')?.getAttribute('data-status')).toBe('ok');
  });

  it('shows the six big losses and the telemetry status', () => {
    expect(qa(fixture, '[data-testid^="loss-"]')).toHaveLength(6);
    expect(q(fixture, 'tm-CNC-1')).not.toBeNull();
    expect(q(fixture, 'oee-verdict')?.textContent).toBeTruthy();
  });
});
