import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SwissVatStore } from './swiss-vat.store';

describe('SwissVatStore', () => {
  const base = `${environment.apiBaseUrl}/swiss-vat`;
  let store: InstanceType<typeof SwissVatStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SwissVatStore],
    });
    store = TestBed.inject(SwissVatStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads returns and updates state after calculating a return', async () => {
    const loadPromise = store.loadReturns(2026);
    http.expectOne(`${base}/config`).flush({
      success: true,
      message: '',
      data: {
        id: 'c1',
        tenant_id: 't1',
        uid_mwst: 'CHE-116.281.710 MWST',
        accounting_method: 'effective',
        consideration_basis: 'agreed',
        reporting_frequency: 'quarterly',
        sss_rate_primary: null,
        sss_rate_secondary: null,
        sss_sector_primary: null,
        sss_sector_secondary: null,
        rounding_mode: 'chf_005',
        auto_detect_bezugsteuer: true,
        bezugsteuer_threshold_chf: '10000.00',
        default_currency: 'CHF',
        canton: 'TI',
        gl_accounts: {},
        updated_at: null,
      },
    });
    http.expectOne((r) => r.url === `${base}/returns`).flush({ success: true, message: '', data: [] });
    await loadPromise;

    const calcPromise = store.calculateReturn({
      fiscal_year: 2026,
      period_type: 'quarterly',
      period_number: 1,
    });
    http.expectOne(`${base}/returns/calculate`).flush({
      success: true,
      message: '',
      data: {
        id: 'r1',
        fiscal_year: 2026,
        period_type: 'quarterly',
        period_number: 1,
        period_label: '2026-Q1',
        period_from: '2026-01-01',
        period_to: '2026-03-31',
        accounting_method: 'effective',
        consideration_basis: 'agreed',
        currency: 'CHF',
        status: 'validated',
        box_200_total_turnover: '10000.00',
        box_289_total_deductions: '0.00',
        box_299_taxable_turnover: '10000.00',
        box_399_total_output_tax: '810.00',
        box_479_total_input_tax: '162.00',
        box_500_payable_amount: '648.00',
        box_510_credit_amount: '0.00',
        gross_turnover: '10810.00',
        invoiced_vat_total: '810.00',
        forfeited_input_vat: '0.00',
        sss_revenue_adjustment: '0.00',
        bezugsteuer_base: '0.00',
        bezugsteuer_tax: '0.00',
        adjustments_box_410: '0.00',
        adjustments_box_415: '0.00',
        adjustments_box_420: '0.00',
        afc_boxes: {},
        quadratura_passed: true,
        quadratura_report: { passed: true, checks: [], blockers_count: 0, warnings_count: 0, blockers: [], warnings: [] },
        reconciliation_lines: [],
        finalized_at: null,
        submitted_at: null,
        suissetax_reference: null,
      },
    });

    const created = await calcPromise;
    expect(created.id).toBe('r1');
    expect(store.returns().length).toBe(1);
    expect(store.latestReturn()?.period_label).toBe('2026-Q1');
  });

  it('tracks pending Bezugsteuer count across detection and confirmation', async () => {
    const loadPromise = store.loadBezugsteuer();
    http.expectOne(`${base}/bezugsteuer`).flush({
      success: true,
      message: '',
      data: [
        {
          id: 'b1',
          swiss_vat_return_id: null,
          source_document_type: 'passive_invoice',
          source_document_id: 'p1',
          supplier_id: null,
          supplier_name: 'Cloud GmbH',
          supplier_country: 'DE',
          supplier_vat_number: 'DE123',
          invoice_number: 'INV-1',
          invoice_date: '2026-02-01',
          service_category: 'software_cloud',
          description: 'Cloud SaaS',
          currency: 'CHF',
          original_net_amount: '1000.00',
          exchange_rate: '1.000000',
          net_amount_chf: '1000.00',
          vat_rate_percent: '8.10',
          tax_amount_chf: '81.00',
          deductible_input_tax_chf: '81.00',
          afc_box: '383',
          detection_source: 'auto_detected',
          detection_reason: null,
          status: 'detected',
          confirmed_at: null,
        },
      ],
    });
    await loadPromise;

    expect(store.pendingBezugsteuerCount()).toBe(1);

    const confirmPromise = store.confirmBezugsteuer('b1');
    http.expectOne(`${base}/bezugsteuer/b1/confirm`).flush({
      success: true,
      message: '',
      data: {
        ...store.bezugsteuer()[0],
        status: 'confirmed',
      },
    });
    await confirmPromise;

    expect(store.pendingBezugsteuerCount()).toBe(0);
    expect(store.confirmedBezugsteuerCount()).toBe(1);
  });
});
