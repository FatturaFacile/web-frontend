import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { icons } from '../../icons-provider';
import {
  AuthStore,
  DashboardApiService,
  InvoiceApiService,
  InvoiceResource,
  KpiSummary,
  KpiSummaryKpis,
} from '@core';
import { DashboardComponent } from './dashboard.component';

const PLACEHOLDER = '—';

// Same keys and value types as GET /api/v1/dashboard/kpi-summary; only the values are invented.
function kpis(): KpiSummaryKpis {
  return {
    total_revenue: 25000,
    total_unpaid: 12000.5,
    invoices_count: 42,
    active_currency: 'EUR',
  };
}

function kpiSummaryResponse(): KpiSummary {
  return {
    tenant: {
      id: '6f1c2a5e-0000-4000-8000-000000000001',
      name: 'Test Srl',
      country: 'IT',
      currency: 'EUR',
    },
    kpis: kpis(),
    metrics_timestamp: '2026-11-12T10:00:00+00:00',
  };
}

function withKpis(overrides: Partial<KpiSummaryKpis>): KpiSummary {
  return { ...kpiSummaryResponse(), kpis: { ...kpis(), ...overrides } };
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockInvoice = {
    id: 'inv-1',
    invoice_number: 'FAT-2026-001',
    issue_date: '2026-04-01',
    due_date: '2026-04-30',
    total_amount: '1220.00',
    balance_due: '1220.00',
    currency: 'EUR',
    status: 'issued',
  } as unknown as InvoiceResource;

  async function setup(
    kpiResponse: Observable<unknown>,
    currency: 'EUR' | 'CHF' = 'EUR',
  ): Promise<void> {
    const dashboardApiMock: Partial<DashboardApiService> = {
      getKpiSummary: vi.fn().mockReturnValue(kpiResponse),
      getCashFlowForecast: vi.fn().mockReturnValue(of({ data: [] })),
      getTaxDeadlines: vi.fn().mockReturnValue(of({ data: [] })),
    };

    const invoiceApiMock: Partial<InvoiceApiService> = {
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

    TestBed.inject(AuthStore).setCurrency(currency);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function renderDeferred(): Promise<HTMLElement> {
    const [deferBlock] = await fixture.getDeferBlocks();
    await deferBlock.render(DeferBlockState.Complete);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function statistics(el: HTMLElement): { title: string; value: string }[] {
    return Array.from(el.querySelectorAll('nz-statistic')).map((stat) => ({
      title: stat.querySelector('.ant-statistic-title')?.textContent?.trim() ?? '',
      value: stat.querySelector('.ant-statistic-content')?.textContent?.trim() ?? '',
    }));
  }

  function expectAllPlaceholders(): void {
    expect(component.revenueDisplay()).toBe(PLACEHOLDER);
    expect(component.receivablesDisplay()).toBe(PLACEHOLDER);
    expect(component.invoicesCount()).toBe(PLACEHOLDER);
  }

  describe('with the real kpi-summary response shape', () => {
    beforeEach(async () => {
      await setup(
        of({
          success: true,
          message: 'Dashboard KPI summary retrieved',
          data: kpiSummaryResponse(),
        }),
      );
    });

    it('stores the response data and loads recent invoices', () => {
      expect(component).toBeTruthy();
      expect(component.kpiSummary()).toEqual(kpiSummaryResponse());
      expect(component.recentInvoices().length).toBe(1);
    });

    it('maps kpis.total_revenue to the revenue card', () => {
      expect(component.revenueDisplay()).toBe('€ 25.000,00');
    });

    it('maps kpis.total_unpaid to the pending card', () => {
      expect(component.receivablesDisplay()).toBe('€ 12.000,50');
    });

    it('maps kpis.invoices_count to the invoices card', () => {
      expect(component.invoicesCount()).toBe(42);
    });

    it('renders exactly three KPI cards with existing label keys and no compliance card', async () => {
      const el = await renderDeferred();
      const stats = statistics(el);

      expect(stats.length).toBe(3);
      expect(stats.map((s) => s.title)).toEqual([
        'ORDERS.REVENUE',
        'DASHBOARD.KPI_PENDING',
        'SALES.INVOICES.TITLE',
      ]);
      expect(stats.map((s) => s.value)).toEqual(['€ 25.000,00', '€ 12.000,50', '42']);
      expect(el.textContent).not.toContain('DASHBOARD.KPI_COMPLIANCE');
    });

    it('stacks the KPI cards below the lg breakpoint and shows three per row from lg upward', async () => {
      const el = await renderDeferred();
      const columns = Array.from(el.querySelectorAll('.stats-grid > [nz-col]'));

      expect(columns.length).toBe(3);
      for (const column of columns) {
        expect(column.classList).toContain('ant-col-xs-24');
        expect(column.classList).toContain('ant-col-lg-8');
        expect([...column.classList].some((c) => c.startsWith('ant-col-sm-'))).toBe(false);
      }
    });
  });

  it('formats CHF amounts with the de-CH locale', async () => {
    await setup(of({ data: kpiSummaryResponse() }), 'CHF');

    // The de-CH grouping separator comes from the runtime ICU data: U+0027 or U+2019 depending on the version.
    expect(component.receivablesDisplay()).toMatch(/^CHF 12['’]000\.50$/);
    expect(component.revenueDisplay()).toMatch(/^CHF 25['’]000\.00$/);
  });

  it('renders EUR amounts with several group separators verbatim', async () => {
    await setup(of({ data: withKpis({ total_revenue: 1234567.89, total_unpaid: 9876543.21 }) }));

    const stats = statistics(await renderDeferred());
    expect(stats[0].value).toBe('€ 1.234.567,89');
    expect(stats[1].value).toBe('€ 9.876.543,21');
  });

  it('renders CHF amounts with several group separators verbatim', async () => {
    await setup(
      of({ data: withKpis({ total_revenue: 1234567.89, total_unpaid: 9876543.21 }) }),
      'CHF',
    );

    const stats = statistics(await renderDeferred());
    expect(stats[0].value).toMatch(/^CHF 1['’]234['’]567\.89$/);
    expect(stats[1].value).toMatch(/^CHF 9['’]876['’]543\.21$/);
  });

  it('shows a genuine zero instead of the placeholder', async () => {
    await setup(of({ data: withKpis({ total_revenue: 0, total_unpaid: 0, invoices_count: 0 }) }));

    expect(component.revenueDisplay()).toBe('€ 0,00');
    expect(component.receivablesDisplay()).toBe('€ 0,00');
    expect(component.invoicesCount()).toBe(0);
  });

  it('shows a genuine CHF zero instead of the placeholder', async () => {
    await setup(of({ data: withKpis({ total_unpaid: 0 }) }), 'CHF');

    expect(component.receivablesDisplay()).toBe('CHF 0.00');
  });

  describe('when KPI data is missing', () => {
    it('shows placeholders and still loads recent invoices when the HTTP call fails', async () => {
      await setup(throwError(() => new Error('Server error')));

      expect(component.kpiSummary()).toBeNull();
      expectAllPlaceholders();
      expect(component.recentInvoices().length).toBe(1);
      expect(component.loading()).toBe(false);

      const stats = statistics(await renderDeferred());
      expect(stats.map((s) => s.value)).toEqual([PLACEHOLDER, PLACEHOLDER, PLACEHOLDER]);
    });

    it('shows placeholders when the response is an empty object', async () => {
      await setup(of({}));

      expectAllPlaceholders();
      expect(component.recentInvoices().length).toBe(1);
      const stats = statistics(await renderDeferred());
      expect(stats.map((s) => s.value)).toEqual([PLACEHOLDER, PLACEHOLDER, PLACEHOLDER]);
    });

    it('shows placeholders when data is undefined', async () => {
      await setup(of({ data: undefined }));

      expectAllPlaceholders();
      const stats = statistics(await renderDeferred());
      expect(stats.map((s) => s.value)).toEqual([PLACEHOLDER, PLACEHOLDER, PLACEHOLDER]);
    });

    it('shows placeholders when tenant, kpis and timestamp are null', async () => {
      await setup(of({ data: { tenant: null, kpis: null, metrics_timestamp: null } }));

      expectAllPlaceholders();
      const stats = statistics(await renderDeferred());
      expect(stats.map((s) => s.value)).toEqual([PLACEHOLDER, PLACEHOLDER, PLACEHOLDER]);
    });

    it('shows a placeholder only on the pending card when total_unpaid is null', async () => {
      await setup(of({ data: withKpis({ total_unpaid: null }) }));

      expect(component.receivablesDisplay()).toBe(PLACEHOLDER);
      expect(component.revenueDisplay()).toBe('€ 25.000,00');
      expect(component.invoicesCount()).toBe(42);
    });

    it('shows a placeholder only on the revenue card when total_revenue is null', async () => {
      await setup(of({ data: withKpis({ total_revenue: null }) }));

      expect(component.revenueDisplay()).toBe(PLACEHOLDER);
      expect(component.receivablesDisplay()).toBe('€ 12.000,50');
      expect(component.invoicesCount()).toBe(42);
    });

    it('shows a placeholder on the invoices card when invoices_count is not a finite number', async () => {
      await setup(of({ data: withKpis({ invoices_count: Number.NaN }) }));

      expect(component.invoicesCount()).toBe(PLACEHOLDER);
      expect(component.revenueDisplay()).toBe('€ 25.000,00');
    });
  });

  it('determines status colors correctly', async () => {
    await setup(of({ data: kpiSummaryResponse() }));

    expect(component.statusColor('paid')).toBe('success');
    expect(component.statusColor('overdue')).toBe('error');
    expect(component.statusColor('issued')).toBe('processing');
    expect(component.statusColor('draft')).toBe('default');
  });
});
