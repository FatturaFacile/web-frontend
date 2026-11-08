import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { icons } from '../../icons-provider';
import { AuthStore, DashboardApiService, InvoiceApiService, InvoiceResource, KpiSummary } from '@core';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let dashboardApiMock: any;
  let invoiceApiMock: any;

  const mockKpi: KpiSummary = {
    revenue_month: 25000,
    revenue_growth_pct: 10,
    open_receivables: 12000,
    overdue_receivables: 1500,
    pending_invoices_count: 5,
    active_alerts_count: 3,
  };

  const mockInvoice: InvoiceResource = {
    id: 'inv-1',
    invoice_number: 'FAT-2026-001',
    issue_date: '2026-04-01',
    due_date: '2026-04-30',
    total_amount: '1220.00',
    balance_due: '1220.00',
    currency: 'EUR',
    status: 'issued',
  };

  beforeEach(async () => {
    dashboardApiMock = {
      getKpiSummary: vi.fn().mockReturnValue(of({ data: mockKpi })),
      getCashFlowForecast: vi.fn().mockReturnValue(of({ data: [] })),
      getTaxDeadlines: vi.fn().mockReturnValue(of({ data: [] })),
    };

    invoiceApiMock = {
      list: vi.fn().mockReturnValue(of({ data: [mockInvoice], meta: { total: 1 } })),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: DashboardApiService, useValue: dashboardApiMock },
        { provide: InvoiceApiService, useValue: invoiceApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component and loads KPI metrics and recent invoices', () => {
    expect(component).toBeTruthy();
    expect(component.kpiSummary()).toEqual(mockKpi);
    expect(component.recentInvoices().length).toBe(1);
    expect(component.pendingCount()).toBe(5);
    expect(component.alertsCount()).toBe(3);
    expect(component.revenueDisplay()).toContain('25');
  });

  it('determines status colors correctly', () => {
    expect(component.statusColor('paid')).toBe('success');
    expect(component.statusColor('overdue')).toBe('error');
    expect(component.statusColor('issued')).toBe('processing');
    expect(component.statusColor('draft')).toBe('default');
  });
});
