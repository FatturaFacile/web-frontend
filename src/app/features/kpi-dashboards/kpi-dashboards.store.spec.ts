import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KpiDashboardsApiService } from './kpi-dashboards-api.service';
import { CatalogEntry } from './kpi-dashboards.models';
import { cockpitFixture, drillFixture, widgetFixture } from './kpi-dashboards.testing';
import { KpiDashboardsStore } from './kpi-dashboards.store';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const entry: CatalogEntry = {
  kpi_code: 'dso',
  role_code: 'cfo',
  widget_type: 'gauge',
  is_monetary: false,
  is_stock: false,
  source_document_type: 'invoices',
  title_key: 'KPI_DASHBOARDS.KPI_DSO',
  description_key: 'KPI_DASHBOARDS.KPI_DSO_DESC',
};

describe('KpiDashboardsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: KpiDashboardsStore;

  beforeEach(() => {
    api = {
      cockpit: vi.fn(() =>
        ok(
          cockpitFixture([
            widgetFixture(),
            widgetFixture({
              widget_id: 'w-2',
              kpi_code: 'order_backlog',
              sort_order: 1,
              widget_type: 'metric_card',
            }),
          ]),
        ),
      ),
      drillDown: vi.fn(() => ok(drillFixture())),
      exportCsv: vi.fn(() => of(new Blob(['a']))),
      catalog: vi.fn(() => ok([entry])),
      saveLayout: vi.fn(() => ok({ id: 'd-2', version: 1 })),
      refreshCubes: vi.fn(() => ok({ refreshed: true, debounced: false })),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: KpiDashboardsApiService, useValue: api }],
    });
    store = TestBed.inject(KpiDashboardsStore);
  });

  it('loads the cockpit of the active role with the global filters', () => {
    store.setRole('cfo');
    store.setCurrency('EUR');
    store.setComparison('mom');
    store.setConsolidated(true);
    store.load().subscribe();

    expect(api['cockpit']).toHaveBeenCalledWith(
      'cfo',
      expect.objectContaining({ currency: 'EUR', comparison: 'mom', consolidated: true }),
    );
    expect(store.widgets().map((w) => w.kpi_code)).toEqual(['ebitda', 'order_backlog']);
    expect(store.loading()).toBe(false);
  });

  it('changes the filters reactively and keeps the others', () => {
    store.patchFilters({ companyIds: ['c1'], preset: 'qtd' });
    store.setCurrency('EUR');

    expect(store.filters()).toMatchObject({
      companyIds: ['c1'],
      preset: 'qtd',
      currency: 'EUR',
      consolidated: false,
    });
  });

  it('waits for both dates of a custom period before asking', () => {
    store.setPreset('custom');
    expect(store.filtersReady()).toBe(false);
    store.load().subscribe();
    expect(api['cockpit']).not.toHaveBeenCalled();

    store.patchFilters({ from: '2026-01-01', to: '2026-03-31' });
    expect(store.filtersReady()).toBe(true);
  });

  it('tells a forbidden cockpit from a failed one', () => {
    api['cockpit']?.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    store.load().subscribe();
    expect(store.forbidden()).toBe(true);
    expect(store.failed()).toBe(false);
    expect(store.widgets()).toEqual([]);

    api['cockpit']?.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.load().subscribe();
    expect(store.forbidden()).toBe(false);
    expect(store.failed()).toBe(true);
  });

  it('opens the drill-down drawer on a segment and pages through it', () => {
    const widget = widgetFixture();
    store.openDrill(widget, { period: '2026-02' }).subscribe();

    expect(store.drillOpen()).toBe(true);
    expect(api['drillDown']).toHaveBeenCalledWith(
      'ebitda',
      expect.anything(),
      { period: '2026-02' },
      1,
    );
    expect(store.drill()?.rows).toHaveLength(1);

    store.loadDrill(2).subscribe();
    expect(api['drillDown']).toHaveBeenLastCalledWith(
      'ebitda',
      expect.anything(),
      { period: '2026-02' },
      2,
    );

    store.closeDrill();
    expect(store.drillOpen()).toBe(false);
    expect(store.drill()).toBeNull();
  });

  it('reports a drill-down that could not be loaded', () => {
    api['drillDown']?.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.openDrill(widgetFixture(), {}).subscribe();

    expect(store.drillFailed()).toBe(true);
    expect(store.drillLoading()).toBe(false);
  });

  it('edits the layout: reorder, resize, remove, add and save as the own cockpit', () => {
    store.load().subscribe();
    store.loadCatalog().subscribe();
    store.startEditing();

    expect(store.draft().map((w) => w.kpi_code)).toEqual(['ebitda', 'order_backlog']);

    store.moveDraft(0, 1);
    store.resizeDraft('ebitda');
    store.addDraft(entry);

    expect(store.draft().map((w) => [w.kpi_code, w.w])).toEqual([
      ['order_backlog', 4],
      ['ebitda', 6],
      ['dso', 4],
    ]);
    expect(store.availableToAdd()).toEqual([]);

    store.removeDraft('order_backlog');
    store.saveLayout().subscribe();

    expect(api['saveLayout']).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboard_id: 'd-1',
        role: 'ceo',
        expected_version: null,
        widgets: [
          expect.objectContaining({ kpi_code: 'ebitda', x: 0, y: 0, w: 6 }),
          expect.objectContaining({ kpi_code: 'dso', x: 6, y: 0, w: 4 }),
        ],
      }),
    );
    expect(store.editing()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('sends the version of an own cockpit so a stale layout is refused', () => {
    const cockpit = cockpitFixture();
    cockpit.dashboard.is_system_default = false;
    cockpit.dashboard.version = 3;
    api['cockpit']?.mockReturnValueOnce(ok(cockpit));
    store.load().subscribe();
    store.startEditing();
    store.saveLayout().subscribe();

    expect(api['saveLayout']).toHaveBeenCalledWith(
      expect.objectContaining({ expected_version: 3 }),
    );
  });

  it('leaves editing without saving', () => {
    store.load().subscribe();
    store.startEditing();
    store.removeDraft('ebitda');
    store.cancelEditing();

    expect(store.editing()).toBe(false);
    expect(api['saveLayout']).not.toHaveBeenCalled();
    expect(store.widgets()).toHaveLength(2);
  });
});
