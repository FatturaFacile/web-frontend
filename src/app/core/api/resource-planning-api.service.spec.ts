import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ResourcePlanningApiService } from './resource-planning-api.service';

describe('ResourcePlanningApiService', () => {
  let service: ResourcePlanningApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/resource-planning`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ResourcePlanningApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ResourcePlanningApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads the heatmap of a window with the granularity and the employee filter', () => {
    service
      .getHeatmap({
        from: '2026-03-02',
        to: '2026-03-29',
        granularity: 'week',
        department_id: 'd-1',
        employee_ids: ['e-1', 'e-2'],
      })
      .subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/capacity/heatmap`);

    expect(request.request.params.get('granularity')).toBe('week');
    expect(request.request.params.get('department_id')).toBe('d-1');
    expect(request.request.params.getAll('employee_id[]')).toEqual(['e-1', 'e-2']);
    request.flush({ data: {} });
  });

  it('lists the allocations that overlap the window', () => {
    service.getAllocations({ from: '2026-03-02', to: '2026-03-08', booking_type: 'SoftTentative' }).subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/allocations`);

    expect(request.request.params.get('from')).toBe('2026-03-02');
    expect(request.request.params.get('booking_type')).toBe('SoftTentative');
    request.flush({ data: [] });
  });

  it('rebalances, converts and deletes an allocation', () => {
    service.rebalance('a-1', { strategy: 'shift', shift_days: 7 }).subscribe();
    const rebalance = httpTesting.expectOne(`${base}/allocations/a-1/rebalance`);
    expect(rebalance.request.method).toBe('POST');
    expect(rebalance.request.body).toEqual({ strategy: 'shift', shift_days: 7 });
    rebalance.flush({ data: {} });

    service.convertToHard('a-1', { project_id: 'p-1' }).subscribe();
    const convert = httpTesting.expectOne(`${base}/allocations/a-1/convert-to-hard`);
    expect(convert.request.body).toEqual({ project_id: 'p-1' });
    convert.flush({ data: {} });

    service.deleteAllocation('a-1').subscribe();
    const remove = httpTesting.expectOne(`${base}/allocations/a-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('searches candidates and reads the billable utilization report', () => {
    service
      .searchCandidates({
        start_date: '2026-03-02',
        end_date: '2026-03-13',
        allocated_hours_per_day: 4,
        requirements: [{ skill_id: 's-1', min_level: 3 }],
      })
      .subscribe();
    const search = httpTesting.expectOne(`${base}/candidates/search`);
    expect(search.request.method).toBe('POST');
    search.flush({ data: [] });

    service.getUtilizationReport('2026-03-01', '2026-03-31', 'department').subscribe();
    const report = httpTesting.expectOne((req) => req.url === `${base}/reports/billable-utilization`);
    expect(report.request.params.get('group_by')).toBe('department');
    report.flush({ data: {} });
  });

  it('upserts a utilization target and an employee skill profile', () => {
    service.saveUtilizationTarget({ department_id: null, target_percent: 75 }).subscribe();
    const target = httpTesting.expectOne(`${base}/utilization-targets`);
    expect(target.request.method).toBe('PUT');
    target.flush({ data: {} });

    service
      .saveSkillProfile({ employee_id: 'e-1', skill_id: 's-1', proficiency_level: 4 })
      .subscribe();
    const profile = httpTesting.expectOne(`${base}/employee-skill-profiles`);
    expect(profile.request.method).toBe('POST');
    profile.flush({ data: {} });
  });
});
