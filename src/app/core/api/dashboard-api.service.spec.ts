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
    const mockKpi: KpiSummary = {
      revenue_month: 45000,
      open_receivables: 18500,
      revenue_ytd: 300000,
      open_payables: 9000,
      pending_invoices_count: 8,
      active_alerts_count: 2,
    };

    service.getKpiSummary().subscribe((res) => {
      expect(res.data.revenue_month).toBe(45000);
      expect(res.data.active_alerts_count).toBe(2);
    });

    const kReq = httpMock.expectOne(`${base}/kpi-summary`);
    expect(kReq.request.method).toBe('GET');
    kReq.flush({ data: mockKpi });

    const mockForecast: CashFlowForecastPoint[] = [
      { date: '2026-05-01', projected_inflow: 20000, projected_outflow: 12000, net_cash_flow: 8000, projected_balance: 8000 },
    ];
    service.getCashFlowForecast().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const cReq = httpMock.expectOne(`${base}/cash-flow-forecast`);
    expect(cReq.request.method).toBe('GET');
    cReq.flush({ data: mockForecast });

    const mockTax: TaxDeadline[] = [
      { id: 'tax-1', title: 'Liquidazione IVA Trimestre 1', due_date: '2026-05-16', jurisdiction: 'IT', amount: 4500, status: 'upcoming' },
    ];
    service.getTaxDeadlines().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const tReq = httpMock.expectOne(`${base}/tax-deadlines`);
    expect(tReq.request.method).toBe('GET');
    tReq.flush({ data: mockTax });
  });
});
