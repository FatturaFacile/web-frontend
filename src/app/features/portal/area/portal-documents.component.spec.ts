import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '@env';
import { I18nService } from '@core';
import { PortalInvoice } from '@core/models/portal-area.models';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18nStub } from '../../hr/recruiting/testing/recruiting-fixtures';
import {
  paymentMethodsFor,
  PortalCheckoutDrawerComponent,
} from './portal-checkout-drawer.component';
import { PortalDocumentsComponent } from './portal-documents.component';

const API = 'https://api.fatturafacile.eu/api/v1';
const INVOICE: PortalInvoice = {
  id: 'inv-1',
  invoice_number: 'INV-1',
  date: '2026-05-01',
  due_date: '2026-05-31',
  currency: 'CHF',
  total_gross: 864.8,
  total_paid: 0,
  payment_status: 'unpaid',
  is_paid: false,
};

function envelope<T>(data: T) {
  return { success: true, message: 'ok', data };
}

describe('PortalDocumentsComponent', () => {
  const originalApiBaseUrl = environment.apiBaseUrl;

  function create(query: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [PortalDocumentsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(PortalDocumentsComponent);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  beforeEach(() => {
    environment.apiBaseUrl = API;
    sessionStorage.clear();
  });

  afterEach(() => {
    environment.apiBaseUrl = originalApiBaseUrl;
    vi.restoreAllMocks();
  });

  it('loads the invoices filtered by the payment status of the link', () => {
    const { fixture, http } = create({ tab: 'invoices', status: 'unpaid' });

    const request = http.expectOne((req) => req.url === `${API}/portal/invoices`);
    expect(request.request.params.get('payment_status')).toBe('unpaid');
    request.flush(envelope([INVOICE]));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('INV-1');
  });

  it('downloads the PDF of an invoice through the authenticated API and saves it', () => {
    const { fixture, http } = create({ tab: 'invoices' });
    http.expectOne((req) => req.url === `${API}/portal/invoices`).flush(envelope([INVOICE]));
    fixture.detectChanges();

    const createUrl = vi.fn(() => 'blob:x');
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    buttons.find((button) => button.textContent?.trim() === 'PORTAL_AREA.PDF')?.click();

    const download = http.expectOne(`${API}/portal/invoices/inv-1/pdf`);
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="Invoice-INV-1.pdf"' },
    });

    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it('offers the XML download of an invoice', () => {
    const { fixture, http } = create({ tab: 'invoices' });
    http.expectOne((req) => req.url === `${API}/portal/invoices`).flush(envelope([INVOICE]));
    fixture.detectChanges();

    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    buttons.find((button) => button.textContent?.trim() === 'PORTAL_AREA.XML')?.click();

    http.expectOne(`${API}/portal/invoices/inv-1/xml`).flush(new Blob(['<xml/>']));
  });
});

describe('PortalCheckoutDrawerComponent', () => {
  it('offers TWINT, card and the QR transfer in Switzerland', () => {
    expect(paymentMethodsFor('CH', 'CHF')).toEqual(['twint', 'card', 'qr_transfer']);
    expect(paymentMethodsFor(null, 'CHF')).toEqual(['twint', 'card', 'qr_transfer']);
  });

  it('offers card, SEPA direct debit and PayPal in Italy and the EU', () => {
    expect(paymentMethodsFor('IT', 'EUR')).toEqual(['card', 'sepa_debit', 'paypal']);
  });

  describe('payment', () => {
    const originalApiBaseUrl = environment.apiBaseUrl;

    beforeEach(() => {
      environment.apiBaseUrl = API;
      vi.useFakeTimers();
      TestBed.configureTestingModule({
        imports: [PortalCheckoutDrawerComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: I18nService, useValue: i18nStub() },
        ],
      });
    });

    afterEach(() => {
      environment.apiBaseUrl = originalApiBaseUrl;
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('opens the hosted payment page and confirms once the invoice is paid', () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const fixture = TestBed.createComponent(PortalCheckoutDrawerComponent);
      fixture.componentRef.setInput('invoice', INVOICE);
      fixture.componentRef.setInput('region', 'IT');
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);

      (fixture.componentInstance as unknown as { pay(): void }).pay();
      http
        .expectOne(`${API}/portal/invoices/inv-1/checkout`)
        .flush(
          envelope({
            invoice_id: 'inv-1',
            provider: 'stripe',
            amount: '864.80',
            currency: 'CHF',
            url: 'https://pay.example.test/x',
          }),
        );
      expect(open).toHaveBeenCalledWith(
        'https://pay.example.test/x',
        '_blank',
        'noopener,noreferrer',
      );

      vi.advanceTimersByTime(5000);
      http
        .expectOne((req) => req.url === `${API}/portal/invoices`)
        .flush(envelope([{ ...INVOICE, payment_status: 'paid', is_paid: true }]));

      expect((fixture.componentInstance as unknown as { state(): string }).state()).toBe('paid');
    });
  });
});
