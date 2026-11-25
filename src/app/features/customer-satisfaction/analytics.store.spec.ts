import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerSatisfactionApiService } from '@core';
import { AnalyticsStore } from './analytics.store';

const ok = <T>(data: T) => of({ success: true, message: '', data });

describe('AnalyticsStore', () => {
  const api = {
    getOverview: vi.fn(),
    getBreakdown: vi.fn(),
    getTrend: vi.fn(),
    getSentiment: vi.fn(),
    listReports: vi.fn(),
    getLookups: vi.fn(),
    generateReport: vi.fn(),
    exportReport: vi.fn(),
  };
  let store: InstanceType<typeof AnalyticsStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getOverview.mockReturnValue(
      ok({ kpis: { total: 12, nps: { score: 42 } }, closed_loop: { sla_compliance: 90 } }),
    );
    api.getBreakdown.mockReturnValue(ok({ group_by: 'department', rows: [{ key: 'support' }] }));
    api.getTrend.mockReturnValue(ok({ granularity: 'month', rows: [{ bucket: '2026-11' }] }));
    api.getSentiment.mockReturnValue(ok({ analyzed: 3, labels: {}, topics: [], keywords: [] }));
    api.listReports.mockReturnValue(ok([{ id: 'r1' }]));
    TestBed.configureTestingModule({
      providers: [AnalyticsStore, { provide: CustomerSatisfactionApiService, useValue: api }],
    });
    store = TestBed.inject(AnalyticsStore);
  });

  it('loads the KPIs, the breakdown, the trend, the sentiment and the reports for the filters', async () => {
    await store.loadAll({ from: '2026-01-01', to: '2026-11-25' });

    expect(api.getOverview).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-11-25' });
    expect(api.getBreakdown).toHaveBeenCalledWith('department', {
      from: '2026-01-01',
      to: '2026-11-25',
    });
    expect(store.overview()?.kpis.nps.score).toBe(42);
    expect(store.breakdown()).toHaveLength(1);
    expect(store.trend()).toHaveLength(1);
    expect(store.reports()).toHaveLength(1);
    expect(store.loading()).toBe(false);
  });

  it('keeps the filters when only the dimension or the granularity changes', async () => {
    await store.loadAll({ survey_type: 'nps' });
    api.getBreakdown.mockReturnValue(
      ok({ group_by: 'branch', rows: [{ key: 'lugano' }, { key: 'milano' }] }),
    );

    await store.setGroupBy('branch');
    await store.setGranularity('quarter');

    expect(api.getBreakdown).toHaveBeenLastCalledWith('branch', { survey_type: 'nps' });
    expect(api.getTrend).toHaveBeenLastCalledWith('quarter', { survey_type: 'nps' });
    expect(store.breakdown()).toHaveLength(2);
  });

  it('reports a load failure as a translation key', async () => {
    api.getOverview.mockReturnValue(throwError(() => new Error('down')));

    await store.loadAll();

    expect(store.error()).toBe('customerSatisfaction.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('generates a Management Review report and puts it first, then downloads it', async () => {
    await store.loadAll();
    api.generateReport.mockReturnValue(ok({ id: 'r2', title: 'Riesame' }));
    api.exportReport.mockReturnValue(of(new Blob(['csv'])));

    const generated = await store.generateReport({ group_by: 'technician' });
    const exported = await store.exportReport('r2', 'csv');

    expect(generated).toMatchObject({ ok: true, id: 'r2' });
    expect(store.reports().map((report) => report.id)).toEqual(['r2', 'r1']);
    expect(api.exportReport).toHaveBeenCalledWith('r2', 'csv');
    expect(exported.blob).toBeInstanceOf(Blob);
  });
});
