import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { FiscalPreferences, I18nService, TaxPreviewRequest } from '@core';
import { icons } from '../../../../icons-provider';
import { InvoiceFormDrawerComponent } from './invoice-form-drawer.component';

const base = environment.apiBaseUrl;
const PREVIEW = `${base}/tax/preview`;

const previewData = (due: string, extra: Record<string, unknown> = {}) => ({
  totals: { net: '1000.00', due },
  vat_summary: [],
  lines: [{ net: '1000.00', tax_rate: '22.00', natura: null }],
  fund: null,
  withholding: null,
  enasarco: null,
  stamp_duty: { applied: false, amount: '0.00', charged_to_customer: true, exempt_base: '0.00' },
  split_payment: false,
  legal_notices: [],
  warnings: [],
  ...extra,
});

describe('InvoiceFormDrawerComponent (Italian fiscal preview)', () => {
  let fixture: ComponentFixture<InvoiceFormDrawerComponent>;
  let component: InvoiceFormDrawerComponent;
  let http: HttpTestingController;
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    message.success.mockReset();
    message.error.mockReset();
    TestBed.configureTestingModule({
      imports: [InvoiceFormDrawerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (k: string) => k } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvoiceFormDrawerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    http.match(() => true);
    vi.useRealTimers();
  });

  /** Opens the drawer and answers the preferences request with the given `fiscal` group. */
  function open(fiscal: FiscalPreferences | unknown[] = []) {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    http.match((r) => r.url === `${base}/crm/contacts`).forEach((r) => r.flush({ data: [] }));
    http
      .expectOne(`${base}/settings/preferences`)
      .flush({ success: true, message: '', data: { fiscal } });
    fixture.detectChanges();
  }

  function fillItalianLine() {
    component.form.patchValue({ jurisdiction: 'IT', currency: 'EUR', contact_id: 'c-1' });
    component.form.controls.items
      .at(0)
      .patchValue({ description: 'Consulenza', quantity: 1, unit_price: 1000, tax_rate: 22 });
  }

  const pendingPreviews = () => http.match(PREVIEW);

  it('sends a single debounced preview after the user stops typing and shows its totals', () => {
    open();
    fillItalianLine();
    component.form.controls.items.at(0).patchValue({ unit_price: 1001 });
    component.form.controls.items.at(0).patchValue({ unit_price: 1000 });

    vi.advanceTimersByTime(299);
    expect(pendingPreviews()).toHaveLength(0);
    expect(component['previewLoading']()).toBe(true);

    vi.advanceTimersByTime(1);
    const req = http.expectOne(PREVIEW);
    const body = req.request.body as TaxPreviewRequest;
    expect(body.items).toEqual([
      {
        description: 'Consulenza',
        quantity: 1,
        unit_price: 1000,
        tax_rate: 22,
        discount_percentage: 0,
        natura: null,
        withholding_applies: true,
        fund_applies: true,
      },
    ]);
    expect(body.contact_id).toBe('c-1');
    expect(body.fund).toBeNull();
    expect(body.withholding).toBeNull();

    req.flush({ success: true, message: '', data: previewData('1068.80') });
    expect(component['previewLoading']()).toBe(false);
    expect(component['preview']()?.totals.due).toBe('1068.80');
  });

  it('never calls the preview for a CH invoice and keeps the local totals', () => {
    open();
    component.form.patchValue({ jurisdiction: 'CH', currency: 'CHF' });
    component.form.controls.items
      .at(0)
      .patchValue({ description: 'x', quantity: 2, unit_price: 100, tax_rate: 8.1 });
    vi.advanceTimersByTime(1000);

    expect(pendingPreviews()).toHaveLength(0);
    expect(component['totals']()).toEqual({ net: 200, vat: 200 * 0.081, gross: 200 * 1.081 });
  });

  it('prefills cassa and ritenuta from the saved fiscal settings, still editable', () => {
    open({
      regime_fiscale: 'RF01',
      default_fund: { type: 'TC22', percent: 4, vat_rate: 22, withholding_applies: false },
      default_withholding: {
        type: 'RT01',
        reason: 'A',
        rate: 20,
        taxable_percent: 100,
        includes_fund: false,
      },
    });
    const c = component.form.controls;
    expect(c.fund_enabled.value).toBe(true);
    expect(c.fund.getRawValue()).toMatchObject({ type: 'TC22', percent: 4 });
    expect(c.withholding_enabled.value).toBe(true);
    expect(c.withholding.getRawValue()).toMatchObject({ type: 'RT01', rate: 20 });
    expect(c.withholding_enabled.enabled).toBe(true);
    expect(c.fund.enabled).toBe(true);

    fillItalianLine();
    vi.advanceTimersByTime(300);
    const body = http.expectOne(PREVIEW).request.body as TaxPreviewRequest;
    expect(body.fund).toMatchObject({ type: 'TC22', percent: 4 });
    expect(body.withholding).toMatchObject({ type: 'RT01', rate: 20 });
  });

  it('locks ritenuta, split payment and reverse charge for a forfettario tenant and preselects N2.2', () => {
    open({ regime_fiscale: 'RF19', default_withholding: { type: 'RT01', reason: 'A', rate: 20 } });
    component.form.patchValue({ jurisdiction: 'IT', currency: 'EUR', contact_id: 'c-1' });
    const c = component.form.controls;

    expect(c.split_payment.disabled).toBe(true);
    expect(c.reverse_charge.disabled).toBe(true);
    expect(c.withholding_enabled.disabled).toBe(true);
    expect(c.withholding_enabled.value).toBe(false);
    expect(c.items.at(0).controls.natura.value).toBe('N2.2');
    expect(c.items.at(0).controls.tax_rate.value).toBe(0);

    c.items.at(0).patchValue({ description: 'Sito web', quantity: 1, unit_price: 100 });
    vi.advanceTimersByTime(300);
    const req = http.expectOne(PREVIEW);
    const body = req.request.body as TaxPreviewRequest;
    expect('withholding' in body).toBe(false);
    expect('split_payment' in body).toBe(false);
    expect(body.items[0].natura).toBe('N2.2');

    req.flush({ data: previewData('102.00', { legal_notices: ['Regime forfettario ...'] }) });
    expect(component['preview']()?.legal_notices).toEqual(['Regime forfettario ...']);
  });

  it('maps a fiscal 422 of the preview onto the field and keeps the last totals', () => {
    open();
    fillItalianLine();
    vi.advanceTimersByTime(300);
    http.expectOne(PREVIEW).flush({ data: previewData('1000.00') });

    component.form.controls.split_payment.setValue(true);
    vi.advanceTimersByTime(300);
    http.expectOne(PREVIEW).flush(
      {
        success: false,
        message: 'Split payment requires VAT',
        code: 'split_payment_requires_vat',
        errors: { split_payment: ['Split payment requires at least one VAT line.'] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(component.form.controls.split_payment.errors).toEqual({
      serverError: 'Split payment requires at least one VAT line.',
    });
    expect(component['previewError']()).toBe(
      'SALES.INVOICES.FISCAL.ERRORS.SPLIT_PAYMENT_REQUIRES_VAT',
    );
    expect(component['preview']()?.totals.due).toBe('1000.00');

    component.form.controls.split_payment.setValue(false);
    vi.advanceTimersByTime(300);
    http.expectOne(PREVIEW).flush({ data: previewData('1220.00') });
    expect(component.form.controls.split_payment.errors).toBeNull();
    expect(component['previewError']()).toBeNull();
  });

  it('sends the fiscal fields on create and shows a readable forfettario_incompatible message', () => {
    open();
    fillItalianLine();
    component.form.patchValue({ invoice_number: 'FT-1', withholding_enabled: true });
    component.submit();

    const req = http.expectOne((r) => r.method === 'POST' && r.url === `${base}/sales/invoices`);
    expect(req.request.body).toMatchObject({
      jurisdiction: 'IT',
      split_payment: false,
      fund: null,
      withholding: { type: 'RT01', reason: 'A' },
      items: [{ natura: null, withholding_applies: true, fund_applies: true }],
    });
    req.flush(
      {
        success: false,
        message: 'Not allowed',
        code: 'forfettario_incompatible',
        errors: { withholding: ['Withholding is not allowed in the flat-rate regime.'] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(component.form.controls.withholding.errors).toEqual({
      serverError: 'Withholding is not allowed in the flat-rate regime.',
    });
    expect(message.error).toHaveBeenCalledWith(
      'SALES.INVOICES.FISCAL.ERRORS.FORFETTARIO_INCOMPATIBLE',
    );
  });

  it('keeps the CH create payload unchanged (no fiscal fields)', () => {
    open();
    component.form.patchValue({ contact_id: 'c-1', invoice_number: 'CH-1', jurisdiction: 'CH' });
    component.form.controls.items
      .at(0)
      .patchValue({ description: 'x', quantity: 1, unit_price: 10 });
    component.submit();

    const body = http.expectOne((r) => r.method === 'POST').request.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        'contact_id',
        'currency',
        'date',
        'due_date',
        'invoice_number',
        'invoice_type',
        'items',
        'jurisdiction',
        'notes',
      ].sort(),
    );
    expect(body['items']).toEqual([
      { description: 'x', quantity: 1, unit_price: 10, tax_rate: 8.1, discount_percentage: 0 },
    ]);
  });
});
