import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManufacturingProductionApiService } from './manufacturing-production-api.service';

describe('ManufacturingProductionApiService', () => {
  let service: ManufacturingProductionApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/manufacturing`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ManufacturingProductionApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and saves work centres and machines', () => {
    service.listWorkCenters({ per_page: 50 }).subscribe();
    const list = http.expectOne((r) => r.url === `${base}/work-centers`);
    expect(list.request.params.get('per_page')).toBe('50');
    list.flush({ data: [] });

    service.createWorkCenter({ work_center_code: 'WC1', name: 'Lathe' }).subscribe();
    expect(http.expectOne(`${base}/work-centers`).request.method).toBe('POST');

    service.updateWorkCenter('w1', { oee_target_percent: 80 }).subscribe();
    const update = http.expectOne(`${base}/work-centers/w1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ oee_target_percent: 80 });

    service.listMachines({ work_center_id: 'w1' }).subscribe();
    expect(http.expectOne((r) => r.url === `${base}/machines`).request.params.get('work_center_id')).toBe('w1');

    service.deleteMachine('m1').subscribe();
    expect(http.expectOne(`${base}/machines/m1`).request.method).toBe('DELETE');
  });

  it('manages working calendars and previews their days', () => {
    service.previewCalendarDays('c1', '2026-12-01', '2026-12-31').subscribe();
    const preview = http.expectOne((r) => r.url === `${base}/working-calendars/c1/preview-days`);
    expect(preview.request.params.get('from')).toBe('2026-12-01');
    expect(preview.request.params.get('to')).toBe('2026-12-31');

    service.updateWorkingCalendar('c1', { name: 'Two shifts' }).subscribe();
    expect(http.expectOne(`${base}/working-calendars/c1`).request.method).toBe('PUT');
  });

  it('saves, clones and simulates routings', () => {
    service.createRouting({ mfg_item_id: 'i1', name: 'R', operations: [] }).subscribe();
    expect(http.expectOne(`${base}/routings`).request.method).toBe('POST');

    service.cloneRoutingRevision('r1', 'B').subscribe();
    const clone = http.expectOne(`${base}/routings/r1/clone-revision`);
    expect(clone.request.body).toEqual({ revision: 'B' });

    service.cloneRoutingRevision('r1').subscribe();
    expect(http.expectOne(`${base}/routings/r1/clone-revision`).request.body).toEqual({});

    service.calculateRouting('r1', { quantity: 10, include_overlap: true }).subscribe();
    const calc = http.expectOne(`${base}/routings/r1/calculate-lead-time-and-cost`);
    expect(calc.request.method).toBe('POST');
    expect(calc.request.body).toEqual({ quantity: 10, include_overlap: true });
  });

  it('queries the OEE summary and time series', () => {
    const query = { work_center_id: 'w1', from_datetime: '2026-12-01T00:00:00Z', to_datetime: '2026-12-02T00:00:00Z', granularity: 'shift' as const };

    service.oeeSummary(query).subscribe();
    const summary = http.expectOne((r) => r.url === `${base}/oee/summary`);
    expect(summary.request.params.get('granularity')).toBe('shift');
    expect(summary.request.params.get('work_center_id')).toBe('w1');

    service.oeeTimeseries(query).subscribe();
    expect(http.expectOne((r) => r.url === `${base}/oee/timeseries`).request.method).toBe('GET');
  });
});
