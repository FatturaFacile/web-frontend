import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnalyticalAccountingApiService,
  AnalyticalCenterNode,
  ApportionmentRun,
  ContributionMarginReport,
} from '@core';
import { AnalyticalAccountingStore } from './analytical-accounting.store';

const center = (id: string, children: AnalyticalCenterNode[] = []): AnalyticalCenterNode => ({
  id,
  parent_id: null,
  code: id,
  name: id,
  center_type: 'COST_CENTER',
  category: 'AUXILIARY',
  path: `/${id}/`,
  depth: 0,
  manager_user_id: null,
  manager_name: null,
  is_active: id !== 'off',
  valid_from: null,
  valid_to: null,
  children,
});

const run = (status: ApportionmentRun['status'], allocations = 2): ApportionmentRun => ({
  id: 'r-1',
  apportionment_schedule_id: 's-1',
  period_key: '2027-03',
  period_start: '2027-03-01',
  period_end: '2027-03-31',
  status,
  total_pool: '1000.0000',
  total_allocated: '1000.0000',
  total_unallocated: '0.0000',
  warnings: [],
  consolidated_at: null,
  reversed_at: null,
  reversal_reason: null,
  steps: [
    {
      step_order: 1,
      source_center_id: 'it',
      driver_type: 'AREA_SQM',
      status: 'EXECUTED',
      pool_amount: '1000.0000',
      allocated_amount: '1000.0000',
      driver_total: '400.00000000',
      warnings: [],
    },
  ],
  allocations: Array.from({ length: allocations }, (_, i) => ({
    id: `a-${i}`,
    step_order: 1,
    source_center_id: 'it',
    target_center_id: `t-${i}`,
    driver_type: 'AREA_SQM' as const,
    driver_value: '200.0000',
    driver_total: '400.0000',
    share_ratio: '0.50000000',
    allocated_amount: '500.0000',
    rounding_adjustment: '0.0000',
    analytical_entry_id: null,
  })),
});

function validationError(message: string): HttpErrorResponse {
  return new HttpErrorResponse({ status: 422, error: { errors: { request: [message] } } });
}

describe('AnalyticalAccountingStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getCenterTree: vi.fn(() => of({ data: [center('root', [center('a'), center('off')])] })),
      getRules: vi.fn(() => of({ data: [{ id: 'r2', priority: 20 }, { id: 'r1', priority: 10 }] })),
      getRuns: vi.fn(() => of({ data: [] })),
      getSchedules: vi.fn(() => of({ data: [{ id: 's-1', is_active: true }, { id: 's-2', is_active: false }] })),
      getDrivers: vi.fn(() => of({ data: [] })),
      previewRun: vi.fn(() => of({ data: run('PREVIEW') })),
      consolidateRun: vi.fn(() => of({ data: run('CONSOLIDATED') })),
      reverseRun: vi.fn(() => of({ data: run('REVERSED') })),
      createCenter: vi.fn(() => of({ data: center('new') })),
      getContributionMargin: vi.fn(() => of({ success: true, data: { statement: {} } as ContributionMarginReport })),
      getDirectVsApportioned: vi.fn(() => of({ success: true, data: { rows: [], totals: {} } })),
    };
    TestBed.configureTestingModule({
      providers: [AnalyticalAccountingStore, { provide: AnalyticalAccountingApiService, useValue: api }],
    });
  });

  it('flattens the tree and keeps the active centers apart', async () => {
    const store = TestBed.inject(AnalyticalAccountingStore);
    await store.loadCenters();

    expect(store.centers().map((c) => c.id)).toEqual(['root', 'a', 'off']);
    expect(store.activeCenters().map((c) => c.id)).toEqual(['root', 'a']);
  });

  it('sorts the rules by priority', async () => {
    const store = TestBed.inject(AnalyticalAccountingStore);
    await store.loadRules();

    expect(store.sortedRules().map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('previews a run and only then allows to consolidate', async () => {
    const store = TestBed.inject(AnalyticalAccountingStore);
    expect(store.canConsolidate()).toBe(false);

    const outcome = await store.preview('s-1', '2027-03');

    expect(outcome.ok).toBe(true);
    expect(api['previewRun']).toHaveBeenCalledWith('s-1', '2027-03');
    expect(store.canConsolidate()).toBe(true);
    expect(store.trace()[0].balanced).toBe(true);
    expect(store.trace()[0].allocations).toHaveLength(2);
  });

  it('consolidates then reverses, refusing the wrong state', async () => {
    const store = TestBed.inject(AnalyticalAccountingStore);
    expect((await store.consolidate()).message).toBe('ANALYTICAL.RUN_NOT_PREVIEW');

    await store.preview('s-1', '2027-03');
    expect((await store.reverse('x')).message).toBe('ANALYTICAL.RUN_NOT_CONSOLIDATED');
    expect((await store.consolidate()).ok).toBe(true);
    expect(store.canReverse()).toBe(true);
    expect(store.canConsolidate()).toBe(false);

    expect((await store.reverse('Correction')).ok).toBe(true);
    expect(api['reverseRun']).toHaveBeenCalledWith('r-1', 'Correction');
    expect(store.activeRun()?.status).toBe('REVERSED');
  });

  it('surfaces the reason of a refused consolidation', async () => {
    api['consolidateRun'] = vi.fn(() => throwError(() => validationError('Period 2027-03 is already consolidated')));
    const store = TestBed.inject(AnalyticalAccountingStore);
    await store.preview('s-1', '2027-03');

    const outcome = await store.consolidate();

    expect(outcome).toEqual({ ok: false, message: 'Period 2027-03 is already consolidated' });
    expect(store.saving()).toBe(false);
    expect(store.activeRun()?.status).toBe('PREVIEW');
  });

  it('reloads the tree after saving a center and reports a refusal', async () => {
    const store = TestBed.inject(AnalyticalAccountingStore);
    const created = await store.saveCenter(null, {
      code: 'N',
      name: 'N',
      center_type: 'COST_CENTER',
      category: 'AUXILIARY',
    });
    expect(created.ok).toBe(true);
    expect(api['getCenterTree']).toHaveBeenCalledTimes(1);

    api['createCenter'] = vi.fn(() => throwError(() => validationError('Cycle')));
    const refused = await store.saveCenter(null, { code: 'M', name: 'M', center_type: 'COST_CENTER', category: 'AUXILIARY' });
    expect(refused).toEqual({ ok: false, message: 'Cycle' });
  });

  it('loads the schedules, drivers and runs of the console together', async () => {
    const store = TestBed.inject(AnalyticalAccountingStore);
    await store.loadApportionment();

    expect(store.activeSchedules().map((s) => s.id)).toEqual(['s-1']);
    expect(store.loading()).toBe(false);
  });

  it('loads both reports with the center filter of the comparison', async () => {
    const store = TestBed.inject(AnalyticalAccountingStore);
    await store.loadReports({ from: '2027-03-01', profit_center_id: 'pc', include_descendants: true });

    expect(api['getDirectVsApportioned']).toHaveBeenCalledWith({
      from: '2027-03-01',
      to: undefined,
      center_id: 'pc',
      include_descendants: true,
    });
    expect(store.margin()).not.toBeNull();
  });

  it('keeps an error when the reports cannot be loaded', async () => {
    api['getContributionMargin'] = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    const store = TestBed.inject(AnalyticalAccountingStore);
    await store.loadReports({});

    expect(store.error()).toBe('ANALYTICAL.LOAD_ERROR');
    expect(store.loading()).toBe(false);
  });
});
