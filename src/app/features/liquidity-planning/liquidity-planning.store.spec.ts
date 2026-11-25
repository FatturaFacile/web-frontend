import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiquidityPlanningApiService } from '@core';
import {
  alert,
  manualItems,
  overview,
  presets,
  report,
  scenarios,
  settings,
} from './liquidity-planning.fixtures';
import { LiquidityPlanningStore } from './liquidity-planning.store';

describe('LiquidityPlanningStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getOverview: vi.fn(() => of({ data: overview })),
      getReport: vi.fn(() => of({ data: report })),
      exportReport: vi.fn(() => of(new Blob(['x']))),
      getPresets: vi.fn(() => of({ data: presets })),
      listScenarios: vi.fn(() => of({ data: scenarios })),
      createScenario: vi.fn(() => of({ data: scenarios[0] })),
      updateScenario: vi.fn(() => of({ data: scenarios[0] })),
      deleteScenario: vi.fn(() => of({ data: null })),
      listManualItems: vi.fn(() => of({ data: manualItems })),
      createManualItem: vi.fn(() => of({ data: manualItems[0] })),
      updateManualItem: vi.fn(() => of({ data: manualItems[0] })),
      deleteManualItem: vi.fn(() => of({ data: null })),
      getSettings: vi.fn(() => of({ data: settings })),
      updateSettings: vi.fn(() => of({ data: settings })),
      evaluateAlerts: vi.fn(() => of({ data: [alert] })),
      acknowledgeAlert: vi.fn(() => of({ data: { ...alert, status: 'acknowledged' } })),
      resolveAlert: vi.fn(() => of({ data: { ...alert, status: 'resolved' } })),
    };
    TestBed.configureTestingModule({
      providers: [LiquidityPlanningStore, { provide: LiquidityPlanningApiService, useValue: api }],
    });
  });

  it('loads the workspace', async () => {
    const store = TestBed.inject(LiquidityPlanningStore);
    await store.init();

    expect(store.overview()?.currency).toBe('EUR');
    expect(store.presets()).toHaveLength(1);
    expect(store.scenarios()).toHaveLength(1);
    expect(store.manualItems()).toHaveLength(1);
    expect(store.settings()?.minimum_liquidity).toBe('5000.00');
    expect(store.activeAlerts()).toHaveLength(1);
    expect(store.criticalAlerts()).toHaveLength(1);
    expect(store.isSimulating()).toBe(false);
  });

  it('reports a failed load with the API text or a key', async () => {
    api['getOverview'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const store = TestBed.inject(LiquidityPlanningStore);
    await store.refresh();

    expect(store.error()).toBe('lp.error.load');
    expect(store.loading()).toBe(false);
  });

  it('runs the what-if with the sanitised levers', async () => {
    const store = TestBed.inject(LiquidityPlanningStore);
    store.setLever('collection_delay_days', 20);
    store.setLever('outflow_change_percent', 0);
    await store.applyDraft();

    expect(api['getOverview']).toHaveBeenLastCalledWith({
      levers: { collection_delay_days: 20, collection_delay_share_percent: 100 },
    });
    expect(store.isSimulating()).toBe(true);
  });

  it('applies a preset and a saved scenario, then resets', async () => {
    const store = TestBed.inject(LiquidityPlanningStore);
    await store.init();
    await store.applyPreset('collection_delay_20');
    expect(store.draftLevers().collection_delay_days).toBe(20);

    await store.selectScenario('s-1');
    expect(store.activeScenarioId()).toBe('s-1');
    expect(api['getOverview']).toHaveBeenLastCalledWith({
      levers: { collection_delay_days: 30, collection_delay_share_percent: 100 },
    });

    await store.resetLevers();
    expect(store.activeScenarioId()).toBeNull();
    expect(api['getOverview']).toHaveBeenLastCalledWith({});
  });

  it('saves a scenario, creating it or overwriting the active one', async () => {
    const store = TestBed.inject(LiquidityPlanningStore);
    await store.init();
    store.setLever('capex_acceleration_days', 60);

    expect((await store.saveScenario('Capex', null, false)).ok).toBe(true);
    expect(api['createScenario']).toHaveBeenCalledWith({
      name: 'Capex',
      description: null,
      levers: { capex_acceleration_days: 60 },
    });

    await store.saveScenario('Capex', null, true);
    expect(api['updateScenario']).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({ name: 'Capex' }),
    );
  });

  it('returns the failure of a save instead of throwing', async () => {
    api['createManualItem'].mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({ status: 422, error: { errors: { amount: ['Invalid amount'] } } }),
      ),
    );
    const store = TestBed.inject(LiquidityPlanningStore);

    const outcome = await store.saveManualItem(null, { ...manualItems[0], label: '' });

    expect(outcome).toEqual({ ok: false, error: 'Invalid amount' });
    expect(store.saving()).toBe(false);
  });

  it('acknowledges and resolves the alerts in place', async () => {
    const store = TestBed.inject(LiquidityPlanningStore);
    await store.init();

    await store.acknowledgeAlert('a-1');
    expect(store.alerts()[0].status).toBe('acknowledged');
    expect(store.criticalAlerts()).toHaveLength(0);

    await store.resolveAlert('a-1');
    expect(store.activeAlerts()).toHaveLength(0);
  });

  it('downloads the export of the plan on screen', async () => {
    const store = TestBed.inject(LiquidityPlanningStore);
    await store.init();

    const result = await store.download('xlsx');

    expect(result.ok).toBe(true);
    expect(result.filename).toBe('liquidity-plan-2027-01-04.xlsx');
    expect(api['exportReport']).toHaveBeenCalledWith('xlsx', {});
    expect(store.exporting()).toBeNull();
  });

  it('loads the report', async () => {
    const store = TestBed.inject(LiquidityPlanningStore);
    await store.loadReport();

    expect(store.report()?.company.name).toBe('Acme SA');
  });
});
