import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { AnalyticsApiService } from './analytics-api.service';
import {
  AnalyticsKpiReport,
  AnalyticsKpiResult,
  AnalyticsReportDefinition,
  AnalyticsSaveReportDefinitionRequest,
  BreakdownEntry,
  DueCalendarEntry,
  RevenueComparisonData,
} from '../models';

describe('AnalyticsApiService', () => {
  let service: AnalyticsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/analytics`;
  const reportingUrl = `${environment.apiBaseUrl}/reporting`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AnalyticsApiService],
    });
    service = TestBed.inject(AnalyticsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should query due-calendar with parameters', () => {
    const mockEntries: DueCalendarEntry[] = [
      {
        id: '1',
        date: '2026-11-15',
        direction: 'inflow',
        amount: 1500,
        currency: 'EUR',
        description: 'Fattura FT-2026-001',
        is_overdue: false,
      },
    ];

    service
      .getDueCalendar({ from: '2026-11-01', to: '2026-11-30', direction: 'inflow', overdue_only: false })
      .subscribe((res) => {
        expect(res.data).toEqual(mockEntries);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/due-calendar` &&
        r.params.get('from') === '2026-11-01' &&
        r.params.get('direction') === 'inflow'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockEntries });
  });

  it('should query revenue-comparison', () => {
    const mockComparison: RevenueComparisonData = {
      year: 2026,
      months: [
        {
          month: 1,
          month_name: 'January',
          revenue: 10000,
          previous_year_revenue: 8000,
          variance: 2000,
          variance_percent: 25,
        },
      ],
      total_revenue: 10000,
      total_previous_revenue: 8000,
      overall_variance_percent: 25,
    };

    service.getRevenueComparison(2026).subscribe((res) => {
      expect(res.data).toEqual(mockComparison);
    });

    const req = httpMock.expectOne(`${baseUrl}/revenue-comparison?year=2026`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockComparison });
  });

  it('should get breakdown for dimension', () => {
    const mockBreakdown: BreakdownEntry[] = [
      { key: 'electronics', label: 'Elettronica', amount: 5000, percentage: 50 },
    ];

    service.getBreakdown('category', 2026).subscribe((res) => {
      expect(res.data).toEqual(mockBreakdown);
    });

    const req = httpMock.expectOne(`${baseUrl}/breakdown/category?year=2026`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockBreakdown });
  });

  it('should query KPIs list and KPI details', () => {
    const mockReport: AnalyticsKpiReport = {
      period: { from: '2026-01-01', to: '2026-11-01' },
      kpis: [
        {
          key: 'sales',
          label: 'Net Sales',
          unit: 'currency',
          kind: 'period',
          available: true,
          value: '45000.00',
        },
      ],
    };

    service.getKpis({ kpis: ['sales', 'margin'], compare: 'previous_year' }).subscribe((res) => {
      expect(res.data).toEqual(mockReport);
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/kpis` &&
        r.params.getAll('kpis[]')?.length === 2 &&
        r.params.get('compare') === 'previous_year'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockReport });

    const singleKpi: AnalyticsKpiResult = {
      key: 'margin',
      label: 'Gross Margin',
      unit: 'percent',
      kind: 'period',
      available: true,
      value: '35.5',
    };

    service.getKpi('margin', { compare: 'previous_period' }).subscribe((res) => {
      expect(res.data).toEqual(singleKpi);
    });

    const singleReq = httpMock.expectOne(`${baseUrl}/kpis/margin?compare=previous_period`);
    expect(singleReq.request.method).toBe('GET');
    singleReq.flush({ data: singleKpi });
  });

  it('should export KPIs and single KPI as CSV blob', () => {
    service.exportKpisCsv({ kpis: ['sales'] }).subscribe((blob) => {
      expect(blob).toBeTruthy();
    });

    const req1 = httpMock.expectOne((r) => r.url === `${baseUrl}/kpis-export`);
    expect(req1.request.method).toBe('GET');
    req1.flush(new Blob(['csv,data'], { type: 'text/csv' }));

    service.exportKpiCsv('sales').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });

    const req2 = httpMock.expectOne(`${baseUrl}/kpis/sales/export`);
    expect(req2.request.method).toBe('GET');
    req2.flush(new Blob(['csv,data'], { type: 'text/csv' }));
  });

  it('should handle custom report definition CRUD and run/export operations', () => {
    const mockDef: AnalyticsReportDefinition = {
      id: 'rep-01',
      user_id: 'user-01',
      name: 'Monthly board pack',
      description: 'Management summary',
      kpis: ['sales', 'margin'],
      period_preset: 'last_month',
      compare: 'previous_year',
      is_shared: true,
      is_owner: true,
    };

    const newDefPayload: AnalyticsSaveReportDefinitionRequest = {
      name: 'Monthly board pack',
      kpis: ['sales', 'margin'],
      period_preset: 'last_month',
      compare: 'previous_year',
      is_shared: true,
    };

    // list
    service.getReportDefinitions().subscribe((res) => {
      expect(res.data).toEqual([mockDef]);
    });
    const listReq = httpMock.expectOne(`${baseUrl}/report-definitions`);
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ data: [mockDef] });

    // create
    service.createReportDefinition(newDefPayload).subscribe((res) => {
      expect(res.data).toEqual(mockDef);
    });
    const createReq = httpMock.expectOne(`${baseUrl}/report-definitions`);
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ data: mockDef });

    // get
    service.getReportDefinition('rep-01').subscribe((res) => {
      expect(res.data).toEqual(mockDef);
    });
    const getReq = httpMock.expectOne(`${baseUrl}/report-definitions/rep-01`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ data: mockDef });

    // update
    service.updateReportDefinition('rep-01', newDefPayload).subscribe((res) => {
      expect(res.data).toEqual(mockDef);
    });
    const updateReq = httpMock.expectOne(`${baseUrl}/report-definitions/rep-01`);
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({ data: mockDef });

    // delete
    service.deleteReportDefinition('rep-01').subscribe();
    const deleteReq = httpMock.expectOne(`${baseUrl}/report-definitions/rep-01`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ data: null });

    // run
    service.runReportDefinition('rep-01').subscribe();
    const runReq = httpMock.expectOne(`${baseUrl}/report-definitions/rep-01/run`);
    expect(runReq.request.method).toBe('GET');
    runReq.flush({ data: { period: { from: '2026-10-01', to: '2026-10-31' }, kpis: [] } });

    // export
    service.exportReportDefinition('rep-01').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });
    const expReq = httpMock.expectOne(`${baseUrl}/report-definitions/rep-01/export`);
    expect(expReq.request.method).toBe('GET');
    expReq.flush(new Blob(['csv'], { type: 'text/csv' }));
  });

  it('should query reporting feed for external BI systems', () => {
    const mockFeed = [{ id: '1', name: 'Order 1', total: 100 }];

    service.getReportingFeed('invoices', { top: 50, skip: 0 }).subscribe((res) => {
      expect(res.data).toEqual(mockFeed);
    });

    const feedReq = httpMock.expectOne(
      (r) =>
        r.url === `${reportingUrl}/feed/invoices` &&
        r.params.get('$top') === '50' &&
        r.params.get('$skip') === '0'
    );
    expect(feedReq.request.method).toBe('GET');
    feedReq.flush({ data: mockFeed });
  });
});
