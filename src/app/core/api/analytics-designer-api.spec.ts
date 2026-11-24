import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { AnalyticsApiService } from './analytics-api.service';

describe('AnalyticsApiService designer endpoints', () => {
  let service: AnalyticsApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/analytics`;
  const ok = { success: true, message: '', data: [] };
  const spec = { measures: ['net_amount'], dimensions: ['customer'] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AnalyticsApiService],
    });
    service = TestBed.inject(AnalyticsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads the semantic catalogue', () => {
    service.getSemanticDatasets().subscribe();
    httpMock.expectOne(`${base}/semantic/datasets`).flush(ok);

    service.getSemanticDataset('sales').subscribe();
    httpMock.expectOne(`${base}/semantic/datasets/sales`).flush(ok);
  });

  it('runs and exports the designer with a POST', () => {
    service.runDesigner({ dataset: 'sales', spec, page: 2 }).subscribe();
    const run = httpMock.expectOne(`${base}/designer/run`);
    expect(run.request.method).toBe('POST');
    expect(run.request.body).toEqual({ dataset: 'sales', spec, page: 2 });
    run.flush(ok);

    service.exportDesigner({ dataset: 'sales', spec, format: 'xlsx' }).subscribe();
    const exported = httpMock.expectOne(`${base}/designer/export`);
    expect(exported.request.method).toBe('POST');
    expect(exported.request.responseType).toBe('blob');
    exported.flush(new Blob(['x']));
  });

  it('manages designed reports', () => {
    service.getDesignedReports().subscribe();
    httpMock.expectOne(`${base}/designed-reports`).flush(ok);

    service.createDesignedReport({ name: 'Sales', dataset: 'sales', spec, is_shared: false }).subscribe();
    expect(httpMock.expectOne(`${base}/designed-reports`).request.method).toBe('POST');

    service.updateDesignedReport('id-1', { name: 'Sales', dataset: 'sales', spec }).subscribe();
    expect(httpMock.expectOne(`${base}/designed-reports/id-1`).request.method).toBe('PUT');

    service.runDesignedReport('id-1', 2, 25).subscribe();
    const run = httpMock.expectOne((r) => r.url === `${base}/designed-reports/id-1/run`);
    expect(run.request.params.get('page')).toBe('2');
    expect(run.request.params.get('per_page')).toBe('25');
    run.flush(ok);

    service.exportDesignedReport('id-1', 'xlsx').subscribe();
    const exported = httpMock.expectOne((r) => r.url === `${base}/designed-reports/id-1/export`);
    expect(exported.request.params.get('format')).toBe('xlsx');
    exported.flush(new Blob(['x']));

    service.deleteDesignedReport('id-1').subscribe();
    expect(httpMock.expectOne(`${base}/designed-reports/id-1`).request.method).toBe('DELETE');
  });

  it('manages export schedules', () => {
    service.getExportSchedules().subscribe();
    httpMock.expectOne(`${base}/export-schedules`).flush(ok);

    service
      .createExportSchedule({ designed_report_id: 'id-1', frequency: 'weekly', day_of_week: 1, delivery: 'documents' })
      .subscribe();
    const create = httpMock.expectOne(`${base}/export-schedules`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.day_of_week).toBe(1);
    create.flush(ok);

    service
      .updateExportSchedule('s-1', { designed_report_id: 'id-1', frequency: 'daily', delivery: 'documents' })
      .subscribe();
    expect(httpMock.expectOne(`${base}/export-schedules/s-1`).request.method).toBe('PUT');

    service.deleteExportSchedule('s-1').subscribe();
    expect(httpMock.expectOne(`${base}/export-schedules/s-1`).request.method).toBe('DELETE');
  });

  it('queries KPI snapshots and drops empty filters', () => {
    service.getKpiSnapshots({ kpi: 'sales', from: '2026-11-01', to: '' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/kpi-snapshots`);
    expect(req.request.params.get('kpi')).toBe('sales');
    expect(req.request.params.has('to')).toBe(false);
    req.flush(ok);
  });
});
