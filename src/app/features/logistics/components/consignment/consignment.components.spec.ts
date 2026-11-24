import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConsignmentLedgerWarehouse,
  ConsumptionReport,
  InventoryValuation,
  LogisticsApiService,
  LookupProduct,
} from '@core';
import { icons } from '../../../../icons-provider';
import { ConsumptionDeclarationWizardComponent } from './consumption-declaration-wizard.component';
import { ValuationSummaryComponent } from './valuation-summary.component';

const warehouse = (type = 'customer_consignment'): ConsignmentLedgerWarehouse => ({
  warehouse_id: 'w1',
  warehouse_code: 'CUS-1',
  warehouse_name: 'Customer 1',
  warehouse_type: type,
  legal_owner_type: 'company',
  partner_id: 'p1',
  on_balance_sheet: true,
  total_fiscal_value: 100,
  rows: [
    {
      product_id: 'prod1',
      sku: 'A',
      name: 'Widget',
      opening_qty: 0,
      sent_qty: 10,
      consumed_qty: 0,
      returned_qty: 0,
      residual_qty: 10,
      unit_cost: 5,
      fiscal_value: 50,
      ddt_references: [],
    },
  ],
});

const product: LookupProduct = {
  id: 'prod1',
  sku: 'A',
  name: 'Widget',
  unit_measure: 'pz',
  cost_price: '5.00',
  sale_price: '12.50',
  tax_rate: '22',
};

describe('consignment components', () => {
  const api = { createDeclaration: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: LogisticsApiService, useValue: api },
      ],
    });
  });

  describe('ConsumptionDeclarationWizardComponent', () => {
    const create = (w: ConsignmentLedgerWarehouse | null) => {
      const fixture = TestBed.createComponent(ConsumptionDeclarationWizardComponent);
      fixture.componentRef.setInput('warehouse', w);
      fixture.componentRef.setInput('products', [product]);
      fixture.detectChanges();
      return { fixture, c: fixture.componentInstance };
    };

    it('defaults the price to the sale price for customers and the VAT rate of the product', () => {
      const { c } = create(warehouse());
      c['setProduct'](0, 'prod1');

      expect(c['lines']()[0]).toMatchObject({ unit_price: 12.5, tax_rate: 22 });
      expect(c['documentKind']()).toBe('sales_invoice');
    });

    it('defaults the price to the cost price for vendor consignment, which yields a purchase order', () => {
      const { c } = create(warehouse('vendor_consignment'));
      c['setProduct'](0, 'prod1');

      expect(c['lines']()[0].unit_price).toBe(5);
      expect(c['documentKind']()).toBe('purchase_order');
    });

    it('computes the preview totals from the lines', () => {
      const { c } = create(warehouse());
      c['setProduct'](0, 'prod1');
      c['setNumber'](0, 'quantity', 4);

      expect(c['totals']().net).toBe(50);
      expect(c['totals']().tax).toBe(11);
      expect(c['totals']().gross).toBe(61);
    });

    it('cannot declare more than the third party still holds, nor without a period', () => {
      const { c } = create(warehouse());
      c['setProduct'](0, 'prod1');
      c['period'].set([new Date(2026, 0, 1), new Date(2026, 0, 31)]);
      c['setNumber'](0, 'quantity', 11);

      expect(c['rows']()[0].issues).toEqual(['EXCEEDS_RESIDUAL']);
      expect(c['stepOneValid']()).toBe(false);

      c['setNumber'](0, 'quantity', 10);
      expect(c['stepOneValid']()).toBe(true);

      c['period'].set([]);
      expect(c['stepOneValid']()).toBe(false);
    });

    it('creates the declaration with local dates and the previewed prices', () => {
      const report: ConsumptionReport = {
        id: 'd1',
        warehouse_id: 'w1',
        direction: 'customer',
        status: 'invoiced',
        generated_document_type: 'sales_invoice',
        generated_document_id: 'inv1',
        total_amount: 61,
      };
      api.createDeclaration.mockReturnValue(of({ success: true, message: '', data: report }));
      const { fixture, c } = create(warehouse());
      const declared = vi.fn();
      fixture.componentInstance.declared.subscribe(declared);

      c['setProduct'](0, 'prod1');
      c['setNumber'](0, 'quantity', 4);
      c['period'].set([new Date(2026, 0, 1, 23, 30), new Date(2026, 0, 31)]);
      c['next']();
      expect(c['step']()).toBe(1);
      c['confirm']();

      expect(api.createDeclaration).toHaveBeenCalledWith({
        warehouse_id: 'w1',
        agreement_id: undefined,
        period_start: '2026-01-01',
        period_end: '2026-01-31',
        notes: undefined,
        lines: [{ product_id: 'prod1', quantity: 4, unit_price: 12.5, tax_rate: 22 }],
      });
      expect(declared).toHaveBeenCalledWith(report);
    });

    it('resets the form for the next warehouse', () => {
      const { fixture, c } = create(warehouse());
      c['setProduct'](0, 'prod1');
      c['addLine']();

      fixture.componentRef.setInput('warehouse', warehouse('vendor_consignment'));
      fixture.detectChanges();

      expect(c['lines']()).toHaveLength(1);
      expect(c['lines']()[0].product_id).toBe('');
      expect(c['step']()).toBe(0);
    });
  });

  describe('ValuationSummaryComponent', () => {
    it('keeps owned stock and third-party consignment stock apart', () => {
      const valuation: InventoryValuation = {
        total_balance_sheet_value: 900,
        excluded_third_party_value: 300,
        by_warehouse_type: {},
        buckets: {
          owned_on_hand: 600,
          owned_in_transit: 100,
          owned_at_customer_consignment: 150,
          owned_at_subcontractor: 50,
          third_party_vendor_consignment_held: 300,
        },
      };
      const fixture = TestBed.createComponent(ValuationSummaryComponent);
      fixture.componentRef.setInput('valuation', valuation);
      fixture.detectChanges();
      const c = fixture.componentInstance;

      expect(c['breakdown']().owned).toHaveLength(4);
      expect(c['breakdown']().ownedTotal).toBe(900);
      expect(c['breakdown']().thirdParty.value).toBe(300);
    });
  });
});
