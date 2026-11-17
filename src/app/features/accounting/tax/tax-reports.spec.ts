import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { I18nService } from '@core';
import { icons } from '../../../icons-provider';
import { EnasarcoStatusComponent } from './enasarco-status.component';
import { StampDutyReportComponent } from './stamp-duty-report.component';
import { WithholdingReportComponent } from './withholding-report.component';

const base = environment.apiBaseUrl;

describe('Italian tax reports', () => {
  let http: HttpTestingController;
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    message.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        { provide: LOCALE_ID, useValue: 'en-US' },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (k: string) => k } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const csvButton = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('[data-testid="csv"]')!;
  const text = (el: HTMLElement, id: string) =>
    el.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? null;

  describe('StampDutyReportComponent', () => {
    function render(invoices: unknown[]) {
      const fixture = TestBed.createComponent(StampDutyReportComponent);
      fixture.detectChanges();
      const req = http.expectOne((r) => r.url === `${base}/tax/stamp-duty/quarterly`);
      req.flush({
        data: {
          year: 2026,
          quarter: 1,
          count: invoices.length,
          total_amount: invoices.length ? '4.00' : '0.00',
          f24: { tributo: '2521', due_date: '2026-05-31', deferrable: true },
          invoices,
        },
      });
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    it('shows an empty state and disables the CSV export without rows', () => {
      const { el } = render([]);
      expect(el.querySelector('[data-testid="empty"]')).not.toBeNull();
      expect(csvButton(el).disabled).toBe(true);
    });

    it('shows totals and F24 data and downloads the backend CSV', () => {
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const { el, fixture } = render([
        { id: 'i1', number: 'FT-1', date: '2026-01-10', customer: 'Rossi', amount: '2.00' },
        { id: 'i2', number: 'FT-2', date: '2026-02-10', customer: 'Bianchi', amount: '2.00' },
      ]);
      expect(text(el, 'count')).toBe('2');
      expect(text(el, 'total')).toBe('€4.00');
      expect(text(el, 'tributo')).toBe('2521');
      expect(text(el, 'due-date')).toBe('31.05.2026');
      expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
      expect(csvButton(el).disabled).toBe(false);

      csvButton(el).click();
      fixture.detectChanges();
      const csv = http.expectOne(
        (r) => r.url === `${base}/tax/stamp-duty/quarterly` && r.params.get('format') === 'csv',
      );
      expect(csv.request.responseType).toBe('blob');
      csv.flush(new Blob(['number;amount'], { type: 'text/csv' }));
      expect(click).toHaveBeenCalledTimes(1);
    });

    it('toasts a failed CSV export rejected by validation', () => {
      const { el, fixture } = render([
        { id: 'i1', number: 'FT-1', date: '2026-01-10', customer: null, amount: '2.00' },
      ]);
      csvButton(el).click();
      fixture.detectChanges();
      http
        .expectOne((r) => r.params.get('format') === 'csv')
        .flush(new Blob(), { status: 422, statusText: 'Unprocessable Entity' });
      expect(message.error).toHaveBeenCalledWith('ACCOUNTING.TAX.CSV_FAILED');
    });
  });

  it('ignores a stale stamp duty response when the quarter changes', () => {
    const fixture = TestBed.createComponent(StampDutyReportComponent);
    fixture.detectChanges();
    const first = http.expectOne((r) => r.url === `${base}/tax/stamp-duty/quarterly`);
    fixture.componentInstance['setQuarter'](4);
    expect(first.cancelled).toBe(true);
    http
      .expectOne((r) => r.params.get('quarter') === '4')
      .flush({
        data: {
          year: 2026,
          quarter: 4,
          count: 0,
          total_amount: '0.00',
          f24: { tributo: '2524', due_date: '2027-02-28', deferrable: false },
          invoices: [],
        },
      });
    expect(fixture.componentInstance['report']()?.quarter).toBe(4);
  });

  describe('WithholdingReportComponent', () => {
    it('lists suppliers with totals and the unpaid withholdings', () => {
      const fixture = TestBed.createComponent(WithholdingReportComponent);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === `${base}/tax/withholdings/report`)
        .flush({
          data: {
            year: 2025,
            suppliers: [
              {
                supplier_id: 's1',
                name: 'Studio Verdi',
                fiscal_code: 'VRDLGU80A01H501U',
                vat_number: null,
                reason: 'A',
                invoices: 2,
                gross_paid: '2000.00',
                taxable: '2000.00',
                withheld: '400.00',
              },
            ],
            totals: { gross_paid: '2000.00', taxable: '2000.00', withheld: '400.00' },
            unpaid_withholdings: [
              {
                passive_invoice_id: 'p9',
                invoice_number: '12/2025',
                date: '2025-12-20',
                supplier_id: 's1',
                name: 'Studio Verdi',
                reason: 'A',
                taxable: '500.00',
                withheld: '100.00',
              },
            ],
          },
        });
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Studio Verdi');
      expect(text(el, 'total-withheld')).toBe('€400.00');
      expect(el.querySelector('[data-testid="unpaid"]')?.textContent).toContain('12/2025');
      expect(csvButton(el).disabled).toBe(false);
    });

    it('disables the CSV export when there is nothing to report', () => {
      const fixture = TestBed.createComponent(WithholdingReportComponent);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === `${base}/tax/withholdings/report`)
        .flush({
          data: {
            year: 2025,
            suppliers: [],
            totals: { gross_paid: '0.00', taxable: '0.00', withheld: '0.00' },
            unpaid_withholdings: [],
          },
        });
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="empty"]')).not.toBeNull();
      expect(csvButton(el).disabled).toBe(true);
    });
  });

  describe('EnasarcoStatusComponent', () => {
    function render() {
      const fixture = TestBed.createComponent(EnasarcoStatusComponent);
      fixture.detectChanges();
      http.match((r) => r.url === `${base}/crm/contacts`).forEach((r) => r.flush({ data: [] }));
      fixture.componentInstance['setContact']('c-1');
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    it('shows YTD commissions, ceiling, remaining cap, minimum and shortfall', () => {
      const { fixture, el } = render();
      const req = http.expectOne((r) => r.url === `${base}/tax/enasarco/status`);
      expect(req.request.params.get('contact_id')).toBe('c-1');
      req.flush({
        data: {
          contact_id: 'c-1',
          year: 2026,
          rate: '8.50',
          ytd_commissions: '20000.00',
          annual_maximum: '27500.00',
          remaining_cap: '7500.00',
          annual_minimum: '490.00',
          ytd_contributions: '850.00',
          shortfall: '0.00',
        },
      });
      fixture.detectChanges();
      expect(text(el, 'ytd')).toBe('€20,000.00');
      expect(text(el, 'max')).toBe('€27,500.00');
      expect(text(el, 'remaining')).toBe('€7,500.00');
      expect(text(el, 'min')).toBe('€490.00');
      expect(text(el, 'shortfall')).toBe('€0.00');
    });

    it('turns enasarco_rate_not_configured into a settings hint', () => {
      const { fixture, el } = render();
      http
        .expectOne((r) => r.url === `${base}/tax/enasarco/status`)
        .flush(
          {
            success: false,
            message: 'No rate',
            code: 'enasarco_rate_not_configured',
            errors: { enasarco: ['No ENASARCO rate configured for 2026.'] },
          },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="rate-missing"]')).not.toBeNull();
      expect(el.querySelector('a[href="/settings"]')).not.toBeNull();
    });
  });
});
