import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { SalesKpis } from '@core';
import { SalesOverviewComponent } from './sales-overview.component';

const KPIS: SalesKpis = {
  period: { from: '2026-01-01', to: '2026-12-31' },
  order_backlog: { open_orders: 7, open_lines: 12, open_net_value: '1500.0000' },
  fill_rate: {
    orders: 10,
    lines: 20,
    lines_fully_delivered: 15,
    line_fill_rate: '75.00',
    quantity_ordered: '100.0000',
    quantity_delivered: '80.0000',
    quantity_fill_rate: '80.00',
  },
  quote_conversion: {
    quotes: 9,
    accepted: 4,
    rejected: 1,
    expired: 1,
    open: 3,
    converted_to_order: 3,
    quoted_net_value: '9000.0000',
    accepted_net_value: '4000.0000',
    conversion_rate: '44.44',
    order_conversion_rate: '33.33',
  },
  returns: { opened: 2, credited: 1 },
};

describe('SalesOverviewComponent', () => {
  async function render() {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SalesOverviewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SalesOverviewComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    return { fixture, http };
  }

  it('requests the KPIs of the year to date and shows them from an object envelope', async () => {
    const { fixture, http } = await render();

    const kpiRequest = http.expectOne((request) => request.url.endsWith('/kpis'));
    expect(kpiRequest.request.method).toBe('GET');
    expect(kpiRequest.request.params.has('from')).toBe(true);
    expect(kpiRequest.request.params.has('to')).toBe(true);
    kpiRequest.flush({ success: true, message: '', data: KPIS });

    for (const request of http.match(() => true)) {
      if (request.request.url.endsWith('.svg')) {
        request.flush('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
        continue;
      }
      request.flush(request.request.url.includes('/translations/') ? { translations: {} } : { success: true, message: '', data: [], meta: { total: 0 } });
    }
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('75.00%');
    expect(text).toContain('44.44%');
    expect(fixture.nativeElement.querySelectorAll('nz-statistic').length).toBeGreaterThanOrEqual(11);
  });

  it('shows no statistics while the KPIs are not loaded', async () => {
    const { fixture, http } = await render();

    http.match(() => true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('nz-statistic').length).toBe(0);
  });
});
