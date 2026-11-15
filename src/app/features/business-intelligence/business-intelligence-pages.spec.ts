import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiCalculatedMeasure, BiDashboard, BiDataset, BiSavedQuery, BiSnapshot, BusinessIntelligenceApiService } from '@core';
import { icons } from '../../icons-provider';
import { BiDashboardsComponent } from './bi-dashboards.component';
import { BiMeasuresComponent } from './bi-measures.component';
import { BiQueriesComponent } from './bi-queries.component';

const page = <T>(data: T) => ({ data });

const dashboard: BiDashboard = {
  id: 'd1',
  owner_id: 'u1',
  owner_name: 'Anna',
  is_owner: true,
  can_edit: true,
  name: 'Sales overview',
  description: null,
  visibility: 'private',
  filters: {} as BiDashboard['filters'],
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-10T10:00:00Z',
};

const savedQuery: BiSavedQuery = {
  id: 'q1',
  owner_id: 'u1',
  owner_name: 'Anna',
  is_owner: true,
  can_edit: true,
  name: 'Revenue by customer',
  description: null,
  dataset: 'sales',
  spec: { dimensions: ['customer'], measures: ['net_amount'] } as BiSavedQuery['spec'],
  calculated_measures: [],
  pivot: null,
  visibility: 'private',
  snapshot_frequency: null,
  next_snapshot_on: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-10T10:00:00Z',
};

const snapshot: BiSnapshot = {
  id: 's1',
  source_type: 'saved_query',
  source_id: 'q1',
  taken_by: 'u1',
  taken_on: '2026-11-14',
  trigger: 'manual',
  status: 'ok',
  error: null,
  row_count: 12,
  created_at: '2026-11-14T10:00:00Z',
};

const measure: BiCalculatedMeasure = {
  id: 'm1',
  dataset: 'sales',
  key: 'margin_pct',
  label: 'Margin %',
  formula: 'margin / net_amount',
  unit: 'percent',
  scale: 2,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

const dataset = {
  key: 'sales',
  label: 'Sales',
  description: '',
  module: 'invoicing',
  supports_period: true,
  period_dimension: 'date',
  dimensions: [],
  measures: [
    { key: 'net_amount', label: 'Net amount', unit: 'currency' },
    { key: 'margin', label: 'Margin', unit: 'currency' },
  ],
  calculated_measures: [],
} as unknown as BiDataset;

describe('business intelligence pages', () => {
  const api = {
    getOverview: vi.fn(),
    getDatasets: vi.fn(),
    getCalculatedMeasures: vi.fn(),
    createCalculatedMeasure: vi.fn(),
    updateCalculatedMeasure: vi.fn(),
    deleteCalculatedMeasure: vi.fn(),
    getSavedQueries: vi.fn(),
    deleteSavedQuery: vi.fn(),
    getDashboards: vi.fn(),
    createDashboard: vi.fn(),
    deleteDashboard: vi.fn(),
    getMembers: vi.fn(),
    getShares: vi.fn(),
    getSnapshots: vi.fn(),
    takeSnapshot: vi.fn(),
    compareSnapshot: vi.fn(),
    deleteSnapshot: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getOverview.mockReturnValue(of(page({ dashboards: 1, saved_queries: 1, scheduled_queries: 0, calculated_measures: 1, recent_dashboards: [], failed_snapshots: [] })));
    api.getDatasets.mockReturnValue(of(page([dataset])));
    api.getCalculatedMeasures.mockReturnValue(of(page([measure])));
    api.getSavedQueries.mockReturnValue(of(page([savedQuery])));
    api.getDashboards.mockReturnValue(of(page([dashboard])));
    api.getMembers.mockReturnValue(of(page([])));
    api.getShares.mockReturnValue(of(page([])));
    api.getSnapshots.mockReturnValue(of(page([snapshot])));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideNzIcons(icons), provideNzI18n(en_US), { provide: BusinessIntelligenceApiService, useValue: api }, { provide: NzMessageService, useValue: message }],
    });
  });

  it('lists the dashboards with the overview figures and searches by name', () => {
    const fixture = TestBed.createComponent(BiDashboardsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.dashboards()).toHaveLength(1);
    expect(component.overview()?.dashboards).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sales overview');

    component.search.set('  sales ');
    component.load();
    expect(api.getDashboards).toHaveBeenLastCalledWith({ search: 'sales', per_page: 100 });
    expect(component.loading()).toBe(false);
  });

  it('creates a dashboard from the form and opens it', () => {
    api.createDashboard.mockReturnValue(of(page(dashboard)));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BiDashboardsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.name.set(' Board ');
    component.description.set('   ');
    component.visibility.set('company');
    component.create();

    expect(api.createDashboard).toHaveBeenCalledWith({ name: 'Board', description: null, visibility: 'company' });
    expect(component.modalVisible()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/business-intelligence/dashboards', 'd1']);
  });

  it('shows the validation message of a refused dashboard and reloads after a delete', () => {
    api.createDashboard.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { name: ['Name required'] } } })));
    api.deleteDashboard.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(BiDashboardsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.create();
    expect(message.error).toHaveBeenCalledWith('Name required');

    component.remove(dashboard);
    expect(api.deleteDashboard).toHaveBeenCalledWith('d1');
    expect(api.getDashboards).toHaveBeenCalledTimes(2);
  });

  it('keeps the dashboard list usable when loading fails', () => {
    api.getDashboards.mockReturnValue(throwError(() => new Error('down')));
    api.getOverview.mockReturnValue(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(BiDashboardsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.overview()).toBeNull();
    expect(message.error).toHaveBeenCalled();
  });

  it('lists the saved queries and removes one', () => {
    api.deleteSavedQuery.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(BiQueriesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.queries()).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Revenue by customer');

    component.search.set('rev');
    component.load();
    expect(api.getSavedQueries).toHaveBeenLastCalledWith({ search: 'rev', per_page: 100 });

    component.remove(savedQuery);
    expect(api.deleteSavedQuery).toHaveBeenCalledWith('q1');
    expect(message.success).toHaveBeenCalled();
  });

  it('takes, compares and deletes snapshots of the selected query', () => {
    api.takeSnapshot.mockReturnValue(of(page(snapshot)));
    api.deleteSnapshot.mockReturnValue(of(undefined));
    api.compareSnapshot.mockReturnValue(
      of(
        page({
          taken_on: '2026-11-14',
          columns: [{ key: 'net_amount', label: 'Net amount', kind: 'measure' }],
          rows: [{ net_amount: { snapshot: 10, current: 12, change: 2 } }],
        }),
      ),
    );
    const fixture = TestBed.createComponent(BiQueriesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.takeSnapshot();
    expect(api.takeSnapshot).not.toHaveBeenCalled();

    component.openSnapshots(savedQuery);
    expect(api.getSnapshots).toHaveBeenCalledWith('saved_query', 'q1');
    expect(component.snapshots()).toHaveLength(1);

    component.takeSnapshot();
    expect(api.takeSnapshot).toHaveBeenCalledWith('saved_query', 'q1');

    component.compare(snapshot);
    expect(component.comparison()?.taken_on).toBe('2026-11-14');

    component.removeSnapshot(snapshot);
    expect(api.deleteSnapshot).toHaveBeenCalledWith('s1');
  });

  it('formats a snapshot comparison cell as then, now and change', () => {
    const component = TestBed.createComponent(BiQueriesComponent).componentInstance;

    expect(component.changeText('Acme', undefined)).toBe('');
    expect(component.changeText(null, undefined)).toBe('');
    expect(component.changeText({ snapshot: null, current: 5, change: null }, 'count')).toContain('-');
    expect(component.changeText({ snapshot: 10, current: 12, change: 2 }, 'count')).toContain('→');
    expect(component.visibilityColor('nonsense')).toBe('default');
  });

  it('lists the calculated measures and offers the measures of the chosen dataset', () => {
    const fixture = TestBed.createComponent(BiMeasuresComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.measures()).toHaveLength(1);
    expect(component.datasets()).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Margin %');
    expect(component.availableMeasures()).toBe('');

    component.dataset.set('sales');
    expect(component.availableMeasures()).toBe('net_amount, margin');
  });

  it('validates a new measure before saving it and creates it with its dataset and key', () => {
    api.createCalculatedMeasure.mockReturnValue(of(page(measure)));
    const fixture = TestBed.createComponent(BiMeasuresComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    expect(component.valid()).toBe(false);
    component.save();
    expect(api.createCalculatedMeasure).not.toHaveBeenCalled();

    component.dataset.set('sales');
    component.key.set('Bad Key');
    component.label.set('Margin %');
    component.formula.set(' margin / net_amount ');
    expect(component.valid()).toBe(false);

    component.key.set('margin_pct');
    expect(component.valid()).toBe(true);
    component.unit.set('percent');
    component.save();

    expect(api.createCalculatedMeasure).toHaveBeenCalledWith({ label: 'Margin %', formula: 'margin / net_amount', unit: 'percent', scale: 2, dataset: 'sales', key: 'margin_pct' });
    expect(component.modalVisible()).toBe(false);
  });

  it('edits an existing measure without sending its dataset or key, and deletes one', () => {
    api.updateCalculatedMeasure.mockReturnValue(of(page(measure)));
    api.deleteCalculatedMeasure.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(BiMeasuresComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal(measure);
    expect(component.key()).toBe('margin_pct');
    component.label.set('Margin percent');
    component.save();
    expect(api.updateCalculatedMeasure).toHaveBeenCalledWith('m1', { label: 'Margin percent', formula: 'margin / net_amount', unit: 'percent', scale: 2 });

    component.remove(measure);
    expect(api.deleteCalculatedMeasure).toHaveBeenCalledWith('m1');
    expect(message.success).toHaveBeenCalledTimes(2);
  });

  it('shows the validation message when a measure is refused', () => {
    api.createCalculatedMeasure.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { formula: ['Formula is not valid'] } } })));
    const fixture = TestBed.createComponent(BiMeasuresComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.dataset.set('sales');
    component.key.set('bad');
    component.label.set('Bad');
    component.formula.set('1 / 0');
    component.save();

    expect(message.error).toHaveBeenCalledWith('Formula is not valid');
  });
});
