import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { DashboardApiService } from './dashboard-api.service';
import { CashFlowForecastPoint, KpiSummary, TaxDeadline } from '../models';

describe('DashboardApiService', () => {
  let service: DashboardApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/dashboard`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DashboardApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DashboardApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches KPI summary, cash flow forecast, and tax deadlines', () => {
    // Same keys and value types as GET /api/v1/dashboard/kpi-summary; only the values are invented.
    const kpiSummaryResponse: KpiSummary = {
      tenant: { id: '6f1c2a5e-0000-4000-8000-000000000001', name: 'Test Srl', country: 'IT', currency: 'EUR' },
      kpis: { total_revenue: 25000, total_unpaid: 12000.5, invoices_count: 42, active_currency: 'EUR' },
      metrics_timestamp: '2026-11-12T10:00:00+00:00',
    };

    let kpiData: KpiSummary | undefined;
    service.getKpiSummary().subscribe((res) => {
      kpiData = res.data;
    });

    const kReq = httpMock.expectOne(`${base}/kpi-summary`);
    expect(kReq.request.method).toBe('GET');
    kReq.flush({ success: true, message: 'Dashboard KPI summary retrieved', data: kpiSummaryResponse });

    expect(kpiData).toEqual(kpiSummaryResponse);
    expect(kpiData?.kpis?.total_unpaid).toBe(12000.5);
    expect(kpiData?.tenant?.name).toBe('Test Srl');

    const mockForecast: CashFlowForecastPoint[] = [
      { date: '2026-05-01', projected_inflow: 20000, projected_outflow: 12000, net_balance: 8000 },
    ];
    service.getCashFlowForecast().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const cReq = httpMock.expectOne(`${base}/cash-flow-forecast`);
    expect(cReq.request.method).toBe('GET');
    cReq.flush({ data: mockForecast });

    const mockTax: TaxDeadline[] = [
      { id: 'tax-1', description: 'Liquidazione IVA Trimestre 1', due_date: '2026-05-16', amount: 4500, status: 'pending' },
    ];
    service.getTaxDeadlines().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const tReq = httpMock.expectOne(`${base}/tax-deadlines`);
    expect(tReq.request.method).toBe('GET');
    tReq.flush({ data: mockTax });
  });
});
