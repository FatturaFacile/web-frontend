import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AnalyticalAccountingApiService } from './analytical-accounting-api.service';

describe('AnalyticalAccountingApiService', () => {
  let service: AnalyticalAccountingApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/analytical`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnalyticalAccountingApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnalyticalAccountingApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads the center tree and can limit it to the active centers', () => {
    service.getCenterTree(true).subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/centers/tree`);

    expect(request.request.params.get('active_only')).toBe('1');
    request.flush({ data: [] });
  });

  it('creates, moves and deactivates a center', () => {
    service
      .createCenter({ code: 'IT', name: 'IT', center_type: 'COST_CENTER', category: 'AUXILIARY' })
      .subscribe();
    expect(httpTesting.expectOne(`${base}/centers`).request.method).toBe('POST');

    service.updateCenter('c-1', { parent_id: 'c-0' }).subscribe();
    const update = httpTesting.expectOne(`${base}/centers/c-1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ parent_id: 'c-0' });

    service.deactivateCenter('c-1', true).subscribe();
    const deactivate = httpTesting.expectOne(`${base}/centers/c-1/deactivate`);
    expect(deactivate.request.body).toEqual({ with_descendants: true });
    httpTesting.match(() => true).forEach((pending) => pending.flush({ data: {} }));
  });

  it('tests the derivation rules with an explicit dimension', () => {
    service.testRules({ account_id: 'acc', explicit: { cost_center_id: 'cc' } }).subscribe();
    const request = httpTesting.expectOne(`${base}/derivation-rules/test`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body.explicit.cost_center_id).toBe('cc');
    request.flush({ data: {} });
  });

  it('saves the values of a driver for one period', () => {
    service.saveDriverValues('d-1', '2027-03', [{ analytical_center_id: 'c-1', value: 300 }]).subscribe();
    const request = httpTesting.expectOne(`${base}/drivers/d-1/values`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      period_key: '2027-03',
      values: [{ analytical_center_id: 'c-1', value: 300 }],
    });
    request.flush({ data: [] });
  });

  it('previews, consolidates and reverses a run', () => {
    service.previewRun('s-1', '2027-03').subscribe();
    expect(httpTesting.expectOne(`${base}/runs/preview`).request.body).toEqual({
      schedule_id: 's-1',
      period_key: '2027-03',
    });

    service.consolidateRun('r-1').subscribe();
    expect(httpTesting.expectOne(`${base}/runs/r-1/consolidate`).request.method).toBe('POST');

    service.reverseRun('r-1', 'Correction').subscribe();
    expect(httpTesting.expectOne(`${base}/runs/r-1/reverse`).request.body).toEqual({
      reason: 'Correction',
    });
    httpTesting.match(() => true).forEach((pending) => pending.flush({ data: {} }));
  });

  it('sends the report filters and drops the empty ones', () => {
    service
      .getContributionMargin({ from: '2027-03-01', profit_center_id: 'pc', include_descendants: true, to: '' })
      .subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/reports/contribution-margin`);

    expect(request.request.params.get('profit_center_id')).toBe('pc');
    expect(request.request.params.get('include_descendants')).toBe('1');
    expect(request.request.params.has('to')).toBe(false);
    request.flush({ data: {} });
  });

  it('builds the CSV export url', () => {
    expect(service.exportUrl('contribution-margin', { from: '2027-03-01' })).toBe(
      `${base}/reports/contribution-margin?from=2027-03-01&format=csv`,
    );
  });
});
