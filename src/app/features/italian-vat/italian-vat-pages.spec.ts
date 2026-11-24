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
import { icons } from '../../icons-provider';
import { ItalianVatAnnualComponent } from './italian-vat-annual.component';
import { ItalianVatCuComponent } from './italian-vat-cu.component';
import { ItalianVatLipeComponent } from './italian-vat-lipe.component';
import { ItalianVatPlafondComponent } from './italian-vat-plafond.component';
import { ItalianVatRegistersComponent } from './italian-vat-registers.component';
import { ItalianVatVentilationPanelComponent } from './italian-vat-ventilation-panel.component';
import { ItalianVatStore } from './italian-vat.store';

const base = `${environment.apiBaseUrl}/italian-vat`;
const envelope = <T>(data: T) => ({ success: true, message: '', data });

describe('Italian VAT pages', () => {
  let http: HttpTestingController;
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    message.success.mockReset();
    message.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        ItalianVatStore,
        { provide: LOCALE_ID, useValue: 'en-US' },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const byId = (el: HTMLElement, id: string) =>
    el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  describe('registers', () => {
    it('loads the sezionali of the sales register and shows the register with its breakdowns', async () => {
      const fixture = TestBed.createComponent(ItalianVatRegistersComponent);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === `${base}/sections`)
        .flush(
          envelope([
            {
              id: 's1',
              register_type: 'sales',
              code: 'V',
              name: 'Sales',
              document_kind: null,
              is_active: true,
            },
          ]),
        );
      await fixture.whenStable();
      fixture.detectChanges();

      const store = TestBed.inject(ItalianVatStore);
      void store.loadRegister('s1', { from: '2026-01-01', to: '2026-03-31' });
      http
        .expectOne((r) => r.url === `${base}/registers/s1`)
        .flush(
          envelope({
            section: { id: 's1', code: 'V', name: 'Sales', register_type: 'sales' },
            entries: [],
            by_rate: [{ rate: '22', taxable: '100.00', vat: '22.00' }],
            by_nature: [{ nature: 'N2.1', taxable: '50.00' }],
            totals: {
              taxable: '150.00',
              vat: '22.00',
              deductible_vat: '0.00',
              non_deductible_vat: '0.00',
              gross: '172.00',
            },
          }),
        );
      http.expectOne((r) => r.url === `${base}/register-prints`).flush(envelope([]));
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'by-rate')).not.toBeNull();
      expect(byId(el, 'by-nature')).not.toBeNull();
      expect(byId(el, 'totals')).not.toBeNull();
      expect(byId(el, 'definitive-print')).not.toBeNull();
    });
  });

  describe('ventilation panel', () => {
    it('blocks the preview until takings and a purchase basis are entered', async () => {
      const fixture = TestBed.createComponent(ItalianVatVentilationPanelComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'preview')?.hasAttribute('disabled')).toBe(true);
      expect(el.querySelectorAll('[data-testid="issue"]').length).toBeGreaterThan(0);
    });
  });

  describe('plafond', () => {
    it('shows the blocking alert and the status tag of an exhausted declaration', async () => {
      const fixture = TestBed.createComponent(ItalianVatPlafondComponent);
      fixture.detectChanges();
      http.expectOne(
        (r) => r.url === `${environment.apiBaseUrl}/crm/clients` || r.url.includes('/clients'),
      );
      http
        .expectOne((r) => r.url === `${base}/plafond/monitor`)
        .flush(
          envelope({
            year: 2026,
            as_of: '2026-06-01',
            declarations: [
              {
                id: 'd1',
                contact_id: 'c1',
                contact_name: 'Export Srl',
                protocol_number: '12345678901234567',
                valid_from: '2026-01-01',
                valid_to: '2026-12-31',
                plafond: '100.00',
                consumed: '100.00',
                residual: '0.00',
                usage_percentage: '100.00',
                status: 'exhausted',
                alert: 'critical',
                days_to_expiry: 100,
              },
            ],
            totals: { plafond: '100.00', consumed: '100.00', residual: '0.00' },
          }),
        );
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'blocked-alert')).not.toBeNull();
      expect(byId(el, 'alert-d1')?.textContent).toContain('italianVat.plafond.alert.critical');
      expect(byId(el, 'plafond-totals')).not.toBeNull();
    });
  });

  describe('LIPE', () => {
    const communication = (overrides: Record<string, unknown> = {}) => ({
      id: 'l1',
      year: 2026,
      quarter: 1,
      status: 'validated',
      settlement_ids: [],
      totals: {
        active_operations: '0',
        passive_operations: '0',
        output_vat: '100.00',
        input_vat: '40.00',
        difference: '60.00',
        previous_debit: '0',
        previous_credit: '0',
        interest: '0',
        balance: '60.00',
      },
      file_name: 'IT01234567890_LI_26T01.xml',
      xsd_errors: [],
      reconciliation_status: 'unbalanced',
      reconciliation: {
        status: 'unbalanced',
        rows: [
          {
            settlement_id: 's1',
            period: '2026-01-01/2026-01-31',
            expected: '20.00',
            ledger: '10.00',
            difference: '10.00',
            status: 'unbalanced',
          },
        ],
        total_expected: '20.00',
        total_ledger: '10.00',
        total_difference: '10.00',
      },
      signature_status: 'unsigned',
      signature_digest: null,
      signer_fingerprint: null,
      signed_at: null,
      transmission_protocol: null,
      transmitted_at: null,
      rejection_reason: null,
      ...overrides,
    });

    it('shows the Erario reconciliation and enables signing but not the ready step', async () => {
      const fixture = TestBed.createComponent(ItalianVatLipeComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/lipe`).flush(envelope([communication()]));
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'erario-l1')).not.toBeNull();
      expect(byId(el, 'xsd-l1')).not.toBeNull();
      expect(byId(el, 'sign-l1')?.hasAttribute('disabled')).toBe(false);
      expect(byId(el, 'ready-l1')?.hasAttribute('disabled')).toBe(true);
      expect(byId(el, 'transmit-l1')?.hasAttribute('disabled')).toBe(true);
    });

    it('blocks the XML download and the signature while the schema check fails', async () => {
      const fixture = TestBed.createComponent(ItalianVatLipeComponent);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === `${base}/lipe`)
        .flush(envelope([communication({ xsd_errors: ['VP9 missing'] })]));
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'download-l1')?.hasAttribute('disabled')).toBe(true);
      expect(byId(el, 'sign-l1')?.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('annual VAT', () => {
    it('offers to calculate a year that has no reconciliation yet', async () => {
      const fixture = TestBed.createComponent(ItalianVatAnnualComponent);
      fixture.detectChanges();
      http
        .expectOne(`${base}/annual-vat/${new Date().getFullYear() - 1}`)
        .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'annual-empty')).not.toBeNull();
      expect(byId(el, 'annual-calculate')).not.toBeNull();
    });

    it('shows the diagnostics and the net position of a calculated year', async () => {
      const fixture = TestBed.createComponent(ItalianVatAnnualComponent);
      fixture.detectChanges();
      http.expectOne(`${base}/annual-vat/${new Date().getFullYear() - 1}`).flush(
        envelope({
          id: 'a1',
          year: 2025,
          status: 'calculated',
          periods: [],
          total_output_vat: '500.00',
          total_input_vat: '200.00',
          pro_rata_percentage: 80,
          pro_rata_adjustment: '-4.00',
          prior_year_credit: '0.00',
          interest_total: '0.00',
          paid_total: '0.00',
          annual_debit: '300.00',
          annual_credit: '0.00',
          ledger_balance: '290.00',
          difference: '10.00',
          is_reconciled: false,
          diagnostics: [{ code: 'ledger_difference', params: { difference: '10.00' } }],
          finalized_at: null,
        }),
      );
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'diagnostic')?.textContent).toContain(
        'italianVat.diagnostic.ledger_difference',
      );
      expect(byId(el, 'net-position')?.textContent).toContain('300');
      expect(byId(el, 'annual-finalize')?.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Certificazione Unica', () => {
    it('lists certifications and F24 payments and warns about unpaid withholdings', async () => {
      const fixture = TestBed.createComponent(ItalianVatCuComponent);
      fixture.detectChanges();
      const year = new Date().getFullYear() - 1;
      http.expectOne(`${base}/cu/${year}`).flush(
        envelope([
          {
            id: 'c1',
            year,
            supplier_id: null,
            recipient_name: 'Mario Rossi',
            recipient_tax_code: 'RSSMRA80A01H501U',
            recipient_vat_number: null,
            recipient_kind: 'professional',
            reason_code: 'A',
            gross_amount: '1000.00',
            non_taxable_amount: '0.00',
            taxable_amount: '1000.00',
            withheld_amount: '200.00',
            contributions_amount: '0.00',
            payments_count: 1,
            status: 'validated',
            validation_errors: null,
            issued_at: null,
          },
        ]),
      );
      http.expectOne(`${base}/cu/${year}/validation`).flush(envelope({ valid: true, errors: [] }));
      http
        .expectOne(`${base}/f24/${year}`)
        .flush(
          envelope([
            {
              id: 'f1',
              year,
              month: 3,
              tax_code: '1040',
              amount_due: '200.00',
              amount_paid: '0.00',
              due_date: `${year}-04-16`,
              paid_at: null,
              f24_reference: null,
              withholding_settlement_id: null,
              status: 'due',
            },
          ]),
        );
      http
        .expectOne(`${base}/f24/${year}/reconciliation`)
        .flush(
          envelope({
            year,
            certified_withheld: '200.00',
            f24_due: '200.00',
            f24_paid: '0.00',
            due_difference: '0.00',
          }),
        );
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(byId(el, 'cu-validation')).not.toBeNull();
      expect(byId(el, 'pdf-c1')).not.toBeNull();
      expect(byId(el, 'f24-unpaid')).not.toBeNull();
      expect(byId(el, 'f24-pay-f1')).not.toBeNull();
      expect(byId(el, 'cu-file')?.hasAttribute('disabled')).toBe(false);
      expect(byId(el, 'cu-issue')?.hasAttribute('disabled')).toBe(false);
    });
  });
});
