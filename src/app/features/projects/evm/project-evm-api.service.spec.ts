import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ProjectEvmApiService } from './project-evm-api.service';

describe('ProjectEvmApiService', () => {
  let service: ProjectEvmApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/projects`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjectEvmApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('recomputes the snapshot of a project', () => {
    service.compute('p1').subscribe();
    const request = http.expectOne(`${base}/p1/evm/compute`);

    expect(request.request.method).toBe('POST');
    request.flush({ data: {} });
  });

  it('reads the WBS breakdown and the waterfall', () => {
    service.wbsBreakdown('p1').subscribe();
    service.waterfall('p1').subscribe();

    http.expectOne(`${base}/p1/evm/wbs-breakdown`).flush({ data: {} });
    http.expectOne(`${base}/p1/evm/waterfall`).flush({ data: {} });
  });

  it('asks the S-curve of a set of projects with the array notation Laravel expects', () => {
    service.scurve({ granularity: 'week', projectIds: ['a', 'b'], from: '2027-01-01' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${base}/evm/scurve`);

    expect(request.request.params.get('granularity')).toBe('week');
    expect(request.request.params.get('from')).toBe('2027-01-01');
    expect(request.request.params.getAll('project_ids[]')).toEqual(['a', 'b']);
    expect(request.request.params.has('to')).toBe(false);
    request.flush({ data: { points: [], forecast: [] } });
  });

  it('sets and clears the manual ETC', () => {
    service.setManualEtc('p1', { wbs_node_id: 'n1', estimate_to_complete: 500 }).subscribe();
    service.setManualEtc('p1', { wbs_node_id: null, estimate_to_complete: null }).subscribe();
    const requests = http.match(`${base}/p1/evm/etc`);

    expect(requests.map((request) => request.request.method)).toEqual(['PUT', 'PUT']);
    expect(requests[0].request.body).toEqual({ wbs_node_id: 'n1', estimate_to_complete: 500 });
    expect(requests[1].request.body).toEqual({ wbs_node_id: null, estimate_to_complete: null });
    requests.forEach((request) => request.flush({ data: {} }));
  });

  it('allocates an overhead pool', () => {
    const payload = {
      run_key: 'OH-1',
      cost_center_id: 'cc1',
      pool_amount: 1000,
      period_start: '2027-01-01',
      period_end: '2027-01-31',
      driver: 'direct_cost' as const,
    };
    service.allocateOverhead(payload).subscribe();
    const request = http.expectOne(`${base}/evm/overhead-allocations`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: { allocations: [] } });
  });
});
