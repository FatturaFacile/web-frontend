import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ControllingApiService } from '@core';
import { ControllingFilters, presetRange } from './controlling-filters.service';

describe('presetRange', () => {
  const today = new Date(2026, 7, 19); // 19 August 2026

  it('covers the current month', () => {
    expect(presetRange('this_month', today)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('covers the last full quarter', () => {
    expect(presetRange('last_quarter', today)).toEqual({ from: '2026-04-01', to: '2026-06-30' });
  });

  it('covers the last full quarter across a year boundary', () => {
    expect(presetRange('last_quarter', new Date(2026, 1, 10))).toEqual({
      from: '2025-10-01',
      to: '2025-12-31',
    });
  });

  it('covers the last 12 months up to the end of the current month', () => {
    expect(presetRange('last_12_months', today)).toEqual({ from: '2025-09-01', to: '2026-08-31' });
  });

  it('runs from the first of January to today for the year to date', () => {
    expect(presetRange('ytd', today)).toEqual({ from: '2026-01-01', to: '2026-08-19' });
  });
});

describe('ControllingFilters', () => {
  let filters: ControllingFilters;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    filters = TestBed.inject(ControllingFilters);
  });

  it('builds the query from the period, baseline, tier and facets', () => {
    filters.setRange('2026-01-01', '2026-06-30');
    filters.compareMode.set('active_budget');
    filters.tier.set('full_industrial');
    filters.setFacet('country_code', 'CH');

    expect(filters.preset()).toBe('custom');
    expect(filters.query()).toEqual({
      date_from: '2026-01-01',
      date_to: '2026-06-30',
      margin_tier: 'full_industrial',
      compare_mode: 'active_budget',
      country_code: 'CH',
    });
    expect(filters.fiscalYear()).toBe(2026);
    expect(filters.lastMonth()).toBe(6);
  });

  it('removes a facet when it is cleared', () => {
    filters.setFacet('job_id', 'job-1');
    filters.setFacet('job_id', null);

    expect(filters.query().job_id).toBeUndefined();
  });

  it('keeps the dates of a custom range when the preset is custom', () => {
    filters.setRange('2025-03-01', '2025-03-31');
    filters.applyPreset('custom');

    expect(filters.dateFrom()).toBe('2025-03-01');
  });
});

describe('ControllingApiService', () => {
  let api: ControllingApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ControllingApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ControllingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('sends the drill path as indexed query parameters and skips empty values', () => {
    api
      .exploreMargins({
        group_by: 'geography',
        date_from: '2026-01-01',
        drill_path: [{ dimension: 'geography', value: 'CH' }],
        country_code: '',
      })
      .subscribe();

    const request = http.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/analytics/margins/explore`,
    );
    expect(request.request.params.get('group_by')).toBe('geography');
    expect(request.request.params.get('drill_path[0][dimension]')).toBe('geography');
    expect(request.request.params.get('drill_path[0][value]')).toBe('CH');
    expect(request.request.params.has('country_code')).toBe(false);
    request.flush({});
  });

  it('posts the allocation period to preview, execute and reverse', () => {
    api.previewAllocation(2026, 3).subscribe();
    const preview = http.expectOne(`${environment.apiBaseUrl}/controlling/allocations/preview`);
    expect(preview.request.body).toEqual({ fiscal_year: 2026, fiscal_month: 3 });
    preview.flush({ data: {} });

    api.reverseAllocation('run-1').subscribe();
    http
      .expectOne(`${environment.apiBaseUrl}/controlling/allocations/run-1/reverse`)
      .flush({ data: {} });
  });

  it('saves the budget grid in bulk', () => {
    api.saveBudgetLines('plan-1', [{ id: 'line-1' }]).subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/budgets/plan-1/lines/bulk`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ lines: [{ id: 'line-1' }] });
    request.flush({ data: {} });
  });

  it('requests the financial KPIs with the 12 month window', () => {
    api.getFinancialKpis('2026-12-31').subscribe();

    const request = http.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/analytics/financial-kpis`,
    );
    expect(request.request.params.get('as_of')).toBe('2026-12-31');
    expect(request.request.params.get('months')).toBe('12');
    request.flush({ data: {} });
  });
});
