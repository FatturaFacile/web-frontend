import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralLedgerApiService, I18nService, PermissionsService } from '@core';
import { GlCountryReturnsComponent } from './gl-country-returns.component';
import { GlLetteringComponent } from './gl-lettering.component';
import { GlLocalizationPacksComponent } from './gl-localization-packs.component';
import { GlUs1099Component } from './gl-us-1099.component';
import { GlUsSalesTaxComponent } from './gl-us-sales-tax.component';

const api = {
  getVatCodePacks: vi.fn(),
  importVatCodePack: vi.fn(),
  getFiscalYears: vi.fn(),
  exportFec: vi.fn(),
  exportSiiVatBook: vi.fn(),
  getUsTaxJurisdictions: vi.fn(),
  createUsTaxJurisdiction: vi.fn(),
  createUsTaxRate: vi.fn(),
  getUsTaxNexus: vi.fn(),
  createUsTaxNexus: vi.fn(),
  updateUsTaxJurisdiction: vi.fn(),
  deleteUsTaxJurisdiction: vi.fn(),
  updateUsTaxRate: vi.fn(),
  deleteUsTaxRate: vi.fn(),
  updateUsTaxNexus: vi.fn(),
  deleteUsTaxNexus: vi.fn(),
  preloadUsTaxRates: vi.fn(),
  lookupUsTaxRate: vi.fn(),
  getUsTaxExemptionCertificates: vi.fn(),
  createUsTaxExemptionCertificate: vi.fn(),
  updateUsTaxExemptionCertificate: vi.fn(),
  deleteUsTaxExemptionCertificate: vi.fn(),
  calculateUsSalesTax: vi.fn(),
  getUs1099Recipients: vi.fn(),
  createUs1099Recipient: vi.fn(),
  updateUs1099Recipient: vi.fn(),
  deleteUs1099Recipient: vi.fn(),
  getUs1099Payments: vi.fn(),
  createUs1099Payment: vi.fn(),
  updateUs1099Payment: vi.fn(),
  deleteUs1099Payment: vi.fn(),
  getUs1099SupplierPayments: vi.fn(),
  getUs1099Summary: vi.fn(),
  getFrenchCa3: vi.fn(),
  exportFrenchCa3: vi.fn(),
  getSpanishModelo303: vi.fn(),
  exportSpanishModelo303: vi.fn(),
  getSpanishModelo390: vi.fn(),
  getGermanUstva: vi.fn(),
  exportGermanUstva: vi.fn(),
  exportDatev: vi.fn(),
  getAccountList: vi.fn(),
  getAccountLedger: vi.fn(),
  getLetterings: vi.fn(),
  createLettering: vi.fn(),
  deleteLettering: vi.fn(),
};
const message = { success: vi.fn() };

async function configure(canWrite: boolean): Promise<void> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [
      GlCountryReturnsComponent,
      GlLetteringComponent,
      GlLocalizationPacksComponent,
      GlUsSalesTaxComponent,
      GlUs1099Component,
    ],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: GeneralLedgerApiService, useValue: api },
      { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
      { provide: NzMessageService, useValue: message },
      { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
    ],
  }).compileComponents();
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getVatCodePacks.mockReturnValue(
    of({
      data: [
        { country: 'FR', name: 'France: TVA', codes: 7 },
        { country: 'ES', name: 'Spain: IVA', codes: 7 },
        { country: 'DE', name: 'Germany: Umsatzsteuer', codes: 8 },
      ],
    }),
  );
  api.importVatCodePack.mockReturnValue(of({ data: { country: 'DE', created: 8, updated: 0 } }));
  api.getFiscalYears.mockReturnValue(of({ data: [{ id: 'fy-1', year_code: '2026' }] }));
  api.exportFec.mockReturnValue(of(new Blob(['fec'])));
  api.exportSiiVatBook.mockReturnValue(of(new Blob(['sii'])));
  api.getUsTaxJurisdictions.mockReturnValue(of({ data: [] }));
  api.getUsTaxNexus.mockReturnValue(of({ data: [] }));
  api.getUs1099Recipients.mockReturnValue(of({ data: [] }));
  api.getUs1099Payments.mockReturnValue(of({ data: [] }));
  api.getUs1099SupplierPayments.mockReturnValue(of({ data: [] }));
  api.getUsTaxExemptionCertificates.mockReturnValue(of({ data: [] }));
  api.getAccountList.mockReturnValue(of({ data: [] }));
  api.getLetterings.mockReturnValue(of({ data: [] }));
});

describe('GlLocalizationPacksComponent', () => {
  it('lists the packs of France, Spain and Germany and imports one', async () => {
    await configure(true);
    const fixture = TestBed.createComponent(GlLocalizationPacksComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Germany: Umsatzsteuer');

    const component = fixture.componentInstance as unknown as { importPack(country: string): void };
    component.importPack('DE');

    expect(api.importVatCodePack).toHaveBeenCalledWith('DE');
    expect(message.success).toHaveBeenCalled();
  });

  it('offers no import to a read-only user', async () => {
    await configure(false);
    const fixture = TestBed.createComponent(GlLocalizationPacksComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('GL.LOC_IMPORT');
  });

  it('exports the FEC of the chosen fiscal year and the SII book of a range, and refuses a reversed range', async () => {
    await configure(true);
    const fixture = TestBed.createComponent(GlLocalizationPacksComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      fiscalYearId: string | null;
      siiType: string;
      siiFrom: string;
      siiTo: string;
      exportFec(): void;
      exportSii(): void;
    };
    // The browser download is not under test.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();

    component.exportFec();
    expect(api.exportFec).not.toHaveBeenCalled();

    component.fiscalYearId = 'fy-1';
    component.exportFec();
    expect(api.exportFec).toHaveBeenCalledWith({ fiscal_year_id: 'fy-1' });

    component.siiType = 'purchases';
    component.siiFrom = '2026-04-01';
    component.siiTo = '2026-03-01';
    component.exportSii();
    expect(api.exportSiiVatBook).not.toHaveBeenCalled();

    component.siiTo = '2026-06-30';
    component.exportSii();
    expect(api.exportSiiVatBook).toHaveBeenCalledWith('purchases', {
      from: '2026-04-01',
      to: '2026-06-30',
    });
  });
});

describe('GlUsSalesTaxComponent', () => {
  it('sends the required area of the level with a new jurisdiction and upper-cases the state', async () => {
    await configure(true);
    api.createUsTaxJurisdiction.mockReturnValue(of({ data: {} }));
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      jurisdictionCode: string;
      jurisdictionName: string;
      jurisdictionState: string;
      jurisdictionLevel: string;
      jurisdictionCounty: string;
      jurisdictionValid(): boolean;
      saveJurisdiction(): void;
    };

    component.jurisdictionCode = 'CA-LA';
    component.jurisdictionName = 'Los Angeles County';
    component.jurisdictionState = 'ca';
    component.jurisdictionLevel = 'county';
    expect(component.jurisdictionValid()).toBe(false);

    component.jurisdictionCounty = 'Los Angeles';
    expect(component.jurisdictionValid()).toBe(true);
    component.saveJurisdiction();

    expect(api.createUsTaxJurisdiction).toHaveBeenCalledWith({
      code: 'CA-LA',
      name: 'Los Angeles County',
      state: 'CA',
      level: 'county',
      county: 'Los Angeles',
      city: null,
      zip_prefix: null,
    });
  });

  it('shows the rate in force today and the calculation with its lines', async () => {
    await configure(true);
    api.getUsTaxJurisdictions.mockReturnValue(
      of({
        data: [
          {
            id: 'j-1',
            code: 'CA',
            name: 'California',
            state: 'CA',
            level: 'state',
            county: null,
            city: null,
            zip_prefix: null,
            is_active: true,
            rates: [
              {
                id: 'r-old',
                jurisdiction_id: 'j-1',
                rate_percent: '6.0000',
                effective_from: '2000-01-01',
                effective_to: '2020-12-31',
                applies_to_shipping: false,
              },
              {
                id: 'r-new',
                jurisdiction_id: 'j-1',
                rate_percent: '7.2500',
                effective_from: '2021-01-01',
                effective_to: null,
                applies_to_shipping: false,
              },
            ],
          },
        ],
      }),
    );
    api.calculateUsSalesTax.mockReturnValue(
      of({
        data: {
          state: 'CA',
          date: '2026-05-01',
          has_nexus: true,
          taxable_amount: '100.00',
          shipping_amount: '0.00',
          lines: [
            {
              jurisdiction_id: 'j-1',
              code: 'CA',
              name: 'California',
              level: 'state',
              rate_percent: '7.2500',
              tax: '7.25',
              exempt: false,
            },
          ],
          rate_percent: '7.2500',
          tax_total: '7.25',
          exempt_tax: '0.00',
          exemption_certificate_id: null,
          reason: null,
        },
      }),
    );
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      calcState: string;
      calcTaxable: number | null;
      calculation(): { tax_total: string; has_nexus: boolean; lines: unknown[] } | null;
      calcValid(): boolean;
      calculate(): void;
    };

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('7.2500%');
    expect(component.calcValid()).toBe(false);

    component.calcState = 'ca';
    component.calcTaxable = 100;
    component.calculate();

    expect(api.calculateUsSalesTax).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'CA', taxable_amount: 100, date: null }),
    );
    expect(component.calculation()?.tax_total).toBe('7.25');
    expect(component.calculation()?.lines).toHaveLength(1);
  });

  it('records a nexus only with a two-letter state and a date', async () => {
    await configure(true);
    api.createUsTaxNexus.mockReturnValue(of({ data: {} }));
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      nexusState: string;
      nexusEstablishedOn: string;
      nexusValid(): boolean;
      saveNexus(): void;
    };

    component.nexusState = 'TEX';
    component.nexusEstablishedOn = '2026-01-01';
    expect(component.nexusValid()).toBe(false);

    component.nexusState = 'tx';
    component.saveNexus();
    expect(api.createUsTaxNexus).toHaveBeenCalledWith({
      state: 'TX',
      nexus_type: 'physical',
      established_on: '2026-01-01',
      registration_number: null,
    });
  });
});

describe('GlUs1099Component', () => {
  it('validates the TIN pattern of the API and never lists a full TIN', async () => {
    await configure(true);
    api.getUs1099Recipients.mockReturnValue(
      of({
        data: [
          {
            id: 'rc-1',
            name: 'Acme LLC',
            business_name: null,
            tin_type: 'ein',
            tin_last4: '6789',
            address_line: null,
            city: null,
            state: null,
            zip: null,
            default_form: '1099-NEC',
            is_exempt: false,
            w9_received_on: null,
          },
        ],
      }),
    );
    api.createUs1099Recipient.mockReturnValue(of({ data: {} }));
    const fixture = TestBed.createComponent(GlUs1099Component);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      recipientName: string;
      recipientTin: string;
      recipientValid(): boolean;
      saveRecipient(): void;
    };

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('***6789');

    component.recipientName = 'Beta Inc';
    component.recipientTin = '12-34';
    expect(component.recipientValid()).toBe(false);

    component.recipientTin = '12-3456789';
    expect(component.recipientValid()).toBe(true);
    component.saveRecipient();
    expect(api.createUs1099Recipient).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Beta Inc',
        tin: '12-3456789',
        tin_type: 'ein',
        default_form: '1099-NEC',
      }),
    );
  });

  it('offers only the boxes of the chosen form and posts a payment', async () => {
    await configure(true);
    api.createUs1099Payment.mockReturnValue(of({ data: {} }));
    const fixture = TestBed.createComponent(GlUs1099Component);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      paymentRecipientId: string | null;
      paymentDate: string;
      paymentAmount: number | null;
      paymentForm: string;
      paymentBox: string;
      boxesOfForm(): readonly string[];
      onFormChange(): void;
      savePayment(): void;
    };

    expect(component.boxesOfForm()).toEqual(['1', '4']);
    component.paymentForm = '1099-MISC';
    component.onFormChange();
    expect(component.boxesOfForm()).toEqual(['1', '2', '3', '6', '10']);
    expect(component.paymentBox).toBe('1');

    component.paymentRecipientId = 'rc-1';
    component.paymentDate = '2026-03-01';
    component.paymentAmount = 2500;
    component.paymentBox = '2';
    component.savePayment();

    expect(api.createUs1099Payment).toHaveBeenCalledWith({
      recipient_id: 'rc-1',
      supplier_payment_id: null,
      paid_on: '2026-03-01',
      amount: 2500,
      form_type: '1099-MISC',
      box: '2',
      reference: null,
    });
  });

  it('loads the summary of the chosen year', async () => {
    await configure(true);
    api.getUs1099Summary.mockReturnValue(
      of({ data: { year: 2026, threshold: '2000.00', recipients: [] } }),
    );
    const fixture = TestBed.createComponent(GlUs1099Component);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      year: number | null;
      loadSummary(): void;
    };

    component.year = 2026;
    component.loadSummary();

    expect(api.getUs1099Summary).toHaveBeenCalledWith(2026);
  });
});

describe('GlUsSalesTaxComponent edit and delete', () => {
  const jurisdiction = {
    id: 'j-1',
    code: 'NV',
    name: 'Nevada',
    state: 'NV',
    level: 'state',
    county: null,
    city: null,
    zip_prefix: null,
    is_active: true,
    rates: [
      {
        id: 'r-1',
        jurisdiction_id: 'j-1',
        rate_percent: '4.6000',
        effective_from: '2020-01-01',
        effective_to: null,
        applies_to_shipping: false,
      },
    ],
  };

  type Sales = {
    editingJurisdictionId(): string | null;
    editingRateId(): string | null;
    editingNexusId(): string | null;
    jurisdictionName: string;
    ratePercent: number | null;
    rateTo: string;
    nexusRegistration: string;
    editJurisdiction(item: unknown): void;
    saveJurisdiction(): void;
    removeJurisdiction(item: unknown): void;
    editRate(row: unknown): void;
    saveRate(): void;
    removeRate(rate: unknown): void;
    editNexus(item: unknown): void;
    saveNexus(): void;
    removeNexus(item: unknown): void;
    preload(): void;
    lookupState: string;
    lookupZip: string;
    lookupValid(): boolean;
    lookup(): void;
    rateRows(): { rate: { id: string }; jurisdiction: { id: string } }[];
  };

  it('updates a jurisdiction without changing its state or level, and deletes it', async () => {
    await configure(true);
    api.getUsTaxJurisdictions.mockReturnValue(of({ data: [jurisdiction] }));
    api.updateUsTaxJurisdiction.mockReturnValue(of({ data: {} }));
    api.deleteUsTaxJurisdiction.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Sales;

    component.editJurisdiction(jurisdiction);
    expect(component.editingJurisdictionId()).toBe('j-1');
    component.jurisdictionName = 'State of Nevada';
    component.saveJurisdiction();

    expect(api.updateUsTaxJurisdiction).toHaveBeenCalledWith('j-1', {
      code: 'NV',
      name: 'State of Nevada',
      county: null,
      city: null,
      zip_prefix: null,
    });
    expect(api.createUsTaxJurisdiction).not.toHaveBeenCalled();
    expect(component.editingJurisdictionId()).toBeNull();

    component.removeJurisdiction(jurisdiction);
    expect(api.deleteUsTaxJurisdiction).toHaveBeenCalledWith('j-1');
  });

  it('lists the rates of every jurisdiction and edits and deletes one', async () => {
    await configure(true);
    api.getUsTaxJurisdictions.mockReturnValue(of({ data: [jurisdiction] }));
    api.updateUsTaxRate.mockReturnValue(of({ data: {} }));
    api.deleteUsTaxRate.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Sales;

    const [row] = component.rateRows();
    expect(row.rate.id).toBe('r-1');
    component.editRate(row);
    component.ratePercent = 6.85;
    component.rateTo = '2026-12-31';
    component.saveRate();

    expect(api.updateUsTaxRate).toHaveBeenCalledWith('r-1', {
      rate_percent: 6.85,
      effective_from: '2020-01-01',
      effective_to: '2026-12-31',
      applies_to_shipping: false,
    });
    expect(api.createUsTaxRate).not.toHaveBeenCalled();

    component.removeRate(row.rate);
    expect(api.deleteUsTaxRate).toHaveBeenCalledWith('r-1');
  });

  it('edits and deletes a nexus and preloads the seed states', async () => {
    await configure(true);
    const nexus = {
      id: 'n-1',
      state: 'NV',
      nexus_type: 'economic',
      established_on: '2026-01-01',
      ended_on: null,
      registration_number: null,
      sales_threshold: null,
      transactions_threshold: null,
    };
    api.getUsTaxNexus.mockReturnValue(of({ data: [nexus] }));
    api.updateUsTaxNexus.mockReturnValue(of({ data: {} }));
    api.deleteUsTaxNexus.mockReturnValue(of(undefined));
    api.preloadUsTaxRates.mockReturnValue(of({ data: { created: 9, skipped: 0 } }));
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Sales;

    component.editNexus(nexus);
    component.nexusRegistration = 'NV-1';
    component.saveNexus();
    expect(api.updateUsTaxNexus).toHaveBeenCalledWith('n-1', {
      nexus_type: 'economic',
      established_on: '2026-01-01',
      ended_on: null,
      registration_number: 'NV-1',
    });

    component.removeNexus(nexus);
    expect(api.deleteUsTaxNexus).toHaveBeenCalledWith('n-1');

    component.preload();
    expect(api.preloadUsTaxRates).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('GL.US_PRELOAD_DONE');
  });

  it('looks up the rate by ZIP code or by state', async () => {
    await configure(true);
    api.lookupUsTaxRate.mockReturnValue(
      of({ data: { state: 'CA', date: '2026-06-01', zip: '90210', has_nexus: false, lines: [], rate_percent: '7.2500' } }),
    );
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Sales;

    expect(component.lookupValid()).toBe(false);
    component.lookupZip = '90210';
    expect(component.lookupValid()).toBe(true);
    component.lookup();

    expect(api.lookupUsTaxRate).toHaveBeenCalledWith({ state: null, zip: '90210', county: null, city: null, date: null });
  });
});

describe('GlUs1099Component edit, delete and supplier payment link', () => {
  type Tax = {
    editingRecipientId(): string | null;
    editingPaymentId(): string | null;
    payments(): unknown[];
    recipientName: string;
    recipientTin: string;
    paymentRecipientId: string | null;
    supplierPaymentId: string | null;
    paymentDate: string;
    paymentAmount: number | null;
    paymentBox: string;
    editRecipient(item: unknown): void;
    saveRecipient(): void;
    removeRecipient(item: unknown): void;
    editPayment(item: unknown): void;
    savePayment(): void;
    removePayment(item: unknown): void;
    onSupplierPaymentChange(): void;
  };
  const recipient = {
    id: 'rc-1',
    name: 'Acme LLC',
    business_name: null,
    tin_type: 'ein',
    tin_last4: '6789',
    address_line: null,
    city: null,
    state: null,
    zip: null,
    default_form: '1099-NEC',
    is_exempt: false,
    w9_received_on: null,
  };
  const payment = {
    id: 'p-1',
    recipient_id: 'rc-1',
    supplier_payment_id: 'sp-0',
    paid_on: '2026-02-10',
    amount: '2500.00',
    currency: 'USD',
    form_type: '1099-NEC',
    box: '1',
    payment_method: null,
    reference: 'WIRE-1',
  };

  it('keeps the stored TIN unless a new one is typed, and deletes a recipient', async () => {
    await configure(true);
    api.getUs1099Recipients.mockReturnValue(of({ data: [recipient] }));
    api.updateUs1099Recipient.mockReturnValue(of({ data: {} }));
    api.deleteUs1099Recipient.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(GlUs1099Component);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Tax;

    component.editRecipient(recipient);
    expect(component.editingRecipientId()).toBe('rc-1');
    expect(component.recipientTin).toBe('');
    component.recipientName = 'Acme Inc';
    component.saveRecipient();

    const withoutTin = api.updateUs1099Recipient.mock.calls[0][1] as Record<string, unknown>;
    expect(withoutTin['name']).toBe('Acme Inc');
    expect('tin' in withoutTin).toBe(false);

    component.editRecipient(recipient);
    component.recipientTin = '123-45-6789';
    component.saveRecipient();
    expect((api.updateUs1099Recipient.mock.calls[1][1] as Record<string, unknown>)['tin']).toBe('123-45-6789');

    component.removeRecipient(recipient);
    expect(api.deleteUs1099Recipient).toHaveBeenCalledWith('rc-1');
  });

  it('lists payments with their link, edits and deletes one', async () => {
    await configure(true);
    api.getUs1099Recipients.mockReturnValue(of({ data: [recipient] }));
    api.getUs1099Payments.mockReturnValue(of({ data: [payment] }));
    api.updateUs1099Payment.mockReturnValue(of({ data: {} }));
    api.deleteUs1099Payment.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(GlUs1099Component);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Tax;

    expect(component.payments()).toHaveLength(1);
    component.editPayment(payment);
    expect(component.editingPaymentId()).toBe('p-1');
    component.paymentAmount = 2400;
    component.paymentBox = '4';
    component.savePayment();

    expect(api.updateUs1099Payment).toHaveBeenCalledWith('p-1', {
      paid_on: '2026-02-10',
      amount: 2400,
      form_type: '1099-NEC',
      box: '4',
      reference: 'WIRE-1',
    });
    component.removePayment(payment);
    expect(api.deleteUs1099Payment).toHaveBeenCalledWith('p-1');
  });

  it('fills a new payment from the chosen supplier payment and sends the link', async () => {
    await configure(true);
    api.getUs1099Recipients.mockReturnValue(of({ data: [recipient] }));
    api.getUs1099SupplierPayments.mockReturnValue(
      of({
        data: [
          { id: 'sp-1', passive_invoice_id: 'pi-1', invoice_number: 'JD-1', paid_at: '2026-02-10', amount: '2500.00', currency: 'USD', reference: 'WIRE-1' },
        ],
      }),
    );
    api.createUs1099Payment.mockReturnValue(of({ data: {} }));
    const fixture = TestBed.createComponent(GlUs1099Component);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Tax;

    component.paymentRecipientId = 'rc-1';
    component.supplierPaymentId = 'sp-1';
    component.onSupplierPaymentChange();
    expect(component.paymentDate).toBe('2026-02-10');
    expect(component.paymentAmount).toBe(2500);

    component.savePayment();
    expect(api.createUs1099Payment).toHaveBeenCalledWith({
      recipient_id: 'rc-1',
      supplier_payment_id: 'sp-1',
      paid_on: '2026-02-10',
      amount: 2500,
      form_type: '1099-NEC',
      box: '1',
      reference: 'WIRE-1',
    });
  });
});

describe('GlUsSalesTaxComponent exemption certificates', () => {
  it('creates a certificate for the chosen customer and sends the customer to the calculation', async () => {
    await configure(true);
    api.createUsTaxExemptionCertificate.mockReturnValue(of({ data: {} }));
    api.calculateUsSalesTax.mockReturnValue(
      of({ data: { state: 'CA', date: '2026-05-01', has_nexus: true, lines: [], rate_percent: '0.0000', tax_total: '0.00', exempt_tax: '0.00', exemption_certificate_id: null, reason: 'no_rate' } }),
    );
    const fixture = TestBed.createComponent(GlUsSalesTaxComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      certContactId: string | null;
      certState: string;
      certNumber: string;
      certIssuedOn: string;
      certExpiresOn: string;
      calcState: string;
      calcTaxable: number | null;
      calcCustomerId: string | null;
      certificateValid(): boolean;
      saveCertificate(): void;
      calculate(): void;
    };

    component.certContactId = 'c-1';
    component.certState = 'ca';
    component.certNumber = 'CERT-1';
    component.certIssuedOn = '2026-01-01';
    component.certExpiresOn = '2025-01-01';
    expect(component.certificateValid()).toBe(false);

    component.certExpiresOn = '2026-12-31';
    expect(component.certificateValid()).toBe(true);
    component.saveCertificate();
    expect(api.createUsTaxExemptionCertificate).toHaveBeenCalledWith({
      contact_id: 'c-1',
      state: 'CA',
      jurisdiction_id: null,
      certificate_number: 'CERT-1',
      reason: 'resale',
      issued_on: '2026-01-01',
      expires_on: '2026-12-31',
      is_active: true,
    });

    component.calcState = 'ca';
    component.calcTaxable = 100;
    component.calcCustomerId = 'c-1';
    component.calculate();
    expect(api.calculateUsSalesTax).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 'c-1' }));
  });
});

describe('GlCountryReturnsComponent', () => {
  type Returns = {
    panels(): { key: string; from: string; to: string; previousCredit: number | null; result: unknown }[];
    annualYear: number | null;
    datevConsultant: number | null;
    run(panel: unknown): void;
    exportReturn(panel: unknown): void;
    runAnnual(): void;
    exportDatev(panel: unknown): void;
  };
  const emptyReturn = { form: 'CA3', country: 'FR', from: '2026-01-01', to: '2026-03-31', boxes: [], vat_due: '0.00', vat_credit: '0.00', warnings: [] };

  it('runs and exports the CA3, the Modelo 303 and the UStVA of a period and refuses a reversed range', async () => {
    await configure(true);
    api.getFrenchCa3.mockReturnValue(of({ data: emptyReturn }));
    api.getSpanishModelo303.mockReturnValue(of({ data: { ...emptyReturn, form: '303', country: 'ES' } }));
    api.getGermanUstva.mockReturnValue(of({ data: { ...emptyReturn, form: 'UStVA', country: 'DE' } }));
    api.exportFrenchCa3.mockReturnValue(of(new Blob(['x'])));
    api.exportSpanishModelo303.mockReturnValue(of(new Blob(['x'])));
    api.exportGermanUstva.mockReturnValue(of(new Blob(['x'])));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    const fixture = TestBed.createComponent(GlCountryReturnsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Returns;
    const [ca3, modelo303, ustva] = component.panels();

    ca3.from = '2026-04-01';
    ca3.to = '2026-03-01';
    component.run(ca3);
    expect(api.getFrenchCa3).not.toHaveBeenCalled();

    ca3.to = '2026-06-30';
    ca3.previousCredit = 15;
    component.run(ca3);
    expect(api.getFrenchCa3).toHaveBeenCalledWith({ from: '2026-04-01', to: '2026-06-30', previous_credit: 15 });
    expect(ca3.result).toBeTruthy();

    component.run(modelo303);
    expect(api.getSpanishModelo303).toHaveBeenCalledWith(expect.objectContaining({ previous_credit: null }));
    component.run(ustva);
    expect(api.getGermanUstva).toHaveBeenCalledWith({ from: ustva.from, to: ustva.to });

    component.exportReturn(ca3);
    component.exportReturn(modelo303);
    component.exportReturn(ustva);
    expect(api.exportFrenchCa3).toHaveBeenCalled();
    expect(api.exportSpanishModelo303).toHaveBeenCalled();
    expect(api.exportGermanUstva).toHaveBeenCalledWith({ from: ustva.from, to: ustva.to });
  });

  it('loads the Modelo 390 of a year and exports the DATEV file with the numbers', async () => {
    await configure(true);
    api.getSpanishModelo390.mockReturnValue(of({ data: { form: '390', country: 'ES', year: 2026, quarters: [], annual: emptyReturn } }));
    api.exportDatev.mockReturnValue(of(new Blob(['x'])));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    const fixture = TestBed.createComponent(GlCountryReturnsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Returns;

    component.annualYear = 2026;
    component.runAnnual();
    expect(api.getSpanishModelo390).toHaveBeenCalledWith(2026);

    component.datevConsultant = 1234;
    component.exportDatev(component.panels()[2]);
    expect(api.exportDatev).toHaveBeenCalledWith(expect.objectContaining({ consultant_number: 1234, client_number: 1, account_length: 4 }));
  });
});

describe('GlLetteringComponent', () => {
  type Lettering = {
    accountId: string | null;
    selected(): ReadonlySet<string>;
    balance(): string;
    toggle(id: string): void;
    load(): void;
    letter(): void;
    remove(item: { lettering_code: string }): void;
  };
  const ledger = {
    data: {
      account: { id: 'a-1', account_code: '411', name: 'Customers', account_type: 'asset', normal_balance: 'debit' },
      currency: 'EUR',
      from: '2026-01-01',
      to: '2026-12-31',
      opening_balance: '0.00',
      closing_balance: '0.00',
      total_debit: '120.00',
      total_credit: '120.00',
      transaction_totals: null,
      lines: [
        { line_id: 'l-1', entry_number: 'E1', posting_date: '2026-03-10', description: 'Invoice', debit: '120.00', credit: '0.00' },
        { line_id: 'l-2', entry_number: 'E2', posting_date: '2026-03-20', description: 'Payment', debit: '0.00', credit: '120.00' },
        { line_id: 'l-3', entry_number: 'E3', posting_date: '2026-03-21', description: 'Other', debit: '0.00', credit: '5.00' },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 500, total: 3 },
    },
  };

  it('letters only a balanced selection of lines of the loaded account', async () => {
    await configure(true);
    api.getAccountLedger.mockReturnValue(of(ledger));
    api.createLettering.mockReturnValue(of({ data: { lettering_code: 'AA', lettered_on: '2026-03-21', lines: 2 } }));
    const fixture = TestBed.createComponent(GlLetteringComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Lettering;

    component.accountId = 'a-1';
    component.load();
    expect(api.getAccountLedger).toHaveBeenCalledWith(expect.objectContaining({ account_id: 'a-1' }));

    component.toggle('l-1');
    component.toggle('l-3');
    expect(component.balance()).toBe('115.00');
    component.letter();
    expect(api.createLettering).not.toHaveBeenCalled();

    component.toggle('l-3');
    component.toggle('l-2');
    expect(component.balance()).toBe('0.00');
    component.letter();
    expect(api.createLettering).toHaveBeenCalledWith({
      journal_line_ids: ['l-1', 'l-2'],
      lettered_on: expect.any(String),
    });
    expect(message.success).toHaveBeenCalled();
    expect(component.selected().size).toBe(0);
  });

  it('removes a lettering by its code', async () => {
    await configure(true);
    api.getLetterings.mockReturnValue(of({ data: [{ lettering_code: 'AA', lettered_on: '2026-03-21', account_id: 'a-1', line_ids: ['l-1', 'l-2'] }] }));
    api.deleteLettering.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(GlLetteringComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Lettering;

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('AA');
    component.remove({ lettering_code: 'AA' });
    expect(api.deleteLettering).toHaveBeenCalledWith('AA');
  });
});
