import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AdvanceReplacement,
  CreditNoteFiscalCheckResult,
  CustomerReturn,
  RefurbishedItem,
  ReturnEligibilityResult,
  ReturnGradingInspection,
  ReturnsApiService,
  ReturnShippingLabel,
  ReturnsSource,
  ReverseLogisticsConfig,
  TranslateService,
} from '@core';
import { ReturnsAdvanceReplacementsComponent } from './returns-advance-replacements.component';
import { ReturnsCreditNotesComponent } from './returns-credit-notes.component';
import { ReturnsGradingBenchComponent } from './returns-grading-bench.component';
import { ReturnsLookupsService } from './returns-lookups.service';
import { ReturnsPortalComponent } from './returns-portal.component';

const rlConfig: ReverseLogisticsConfig = {
  settings: {
    return_window_days: 30,
    warranty_window_days: 730,
    default_restocking_fee_percent: '10.00',
    advance_replacement_sla_days: 15,
    outlet_devaluation_grade_b_percent: '20.00',
    outlet_devaluation_grade_c_percent: '35.00',
  },
  reason_codes: [{ code: 'right_of_withdrawal', label: 'Right of withdrawal', is_defect: false }],
  grades: [{ code: 'grade_b', label: 'Grade B', default_disposition: 'convert_b_stock', default_devaluation_percent: '20.00' }],
  tax_rules: { it_art26_summary: 'Art. 26', it_art26_n2_2_explanation: 'N2.2', ch_art41_summary: 'Art. 41 LIVA' },
};

const sampleSource: ReturnsSource = {
  type: 'invoice',
  id: 'inv-1',
  number: 'INV-2027-001',
  date: '2027-06-01',
  within_window: true,
  lines: [
    {
      source_item_id: 'item-1',
      product_id: 'prod-1',
      description: 'Laptop X1',
      quantity_sold: '2.0000',
      quantity_returned: '0.0000',
      quantity_available: '2.0000',
      unit_price: '1000.0000',
    },
  ],
};

const sampleEligibility: ReturnEligibilityResult = {
  eligible: true,
  within_return_window: true,
  within_warranty_window: true,
  return_window_days: 30,
  warranty_window_days: 730,
  days_since_purchase: 14,
  source_date: '2027-06-01',
  is_defect_reason: false,
  restocking_fee_applicable: true,
  restocking_fee_percent: '10.00',
  restocking_fee_amount: '100.00',
  gross_return_amount: '1000.00',
  net_refundable_amount: '900.00',
};

const sampleCustomerReturn: CustomerReturn = {
  id: 'cr-1',
  rma_number: 'CRMA-2027-0001',
  rma_barcode: 'RMA-BC-CRMA20270001-123456',
  return_tracking_number: 'TRK-CRMA-2027-0001',
  carrier: 'DHL Express Reverse',
  status: 'requested',
  channel: 'portal_b2c',
  contact_id: 'con-1',
  customer_name: 'Rossi Srl',
  invoice_id: 'inv-1',
  invoice_number: 'INV-2027-001',
  invoice_date: '2026-01-10',
  delivery_note_id: null,
  delivery_note_number: null,
  sales_order_id: null,
  warehouse_id: null,
  reason_code: 'right_of_withdrawal',
  requested_on: '2027-06-15',
  within_return_window: true,
  within_warranty_window: true,
  window_overridden: false,
  days_since_purchase: 14,
  restocking_fee_applicable: true,
  restocking_fee_percent: '10.00',
  restocking_fee_amount: '100.00',
  gross_return_amount: '1000.00',
  net_refundable_amount: '900.00',
  photo_urls: ['https://cdn.test/photo1.jpg'],
  customer_notes: null,
  internal_notes: null,
  resolution_type: null,
  credit_note_id: null,
  credit_note_reference: null,
  lines: [],
  created_at: '2027-06-15T09:00:00Z',
  updated_at: '2027-06-15T09:00:00Z',
};

const sampleLabel: ReturnShippingLabel = {
  rma_number: 'CRMA-2027-0001',
  rma_barcode: 'RMA-BC-CRMA20270001-123456',
  barcode_format: 'CODE128',
  carrier: 'DHL Express Reverse',
  tracking_number: 'TRK-CRMA-2027-0001',
  generated_at: '2027-06-15T09:00:00Z',
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn((k: string) => k), translate: vi.fn((k: string) => k) };
const lookupsSpy = {
  customers: () => [{ id: 'con-1', label: 'Rossi Srl' }],
  suppliers: () => [{ id: 'sup-1', label: 'Acme Parts' }],
  products: () => [{ id: 'prod-1', label: 'LAPTOP-X1 - Laptop X1', costPrice: '500' }],
  warehouses: () => [{ id: 'wh-1', label: 'MAIN - Main warehouse' }],
  reasons: () => [],
  searchCustomers: vi.fn(),
  searchProducts: vi.fn(),
  loadSuppliers: vi.fn(),
  loadWarehouses: vi.fn(),
  loadReasons: vi.fn(),
};

function setupTestBed(api: Record<string, unknown>, component: Type<unknown>): void {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      { provide: ReturnsApiService, useValue: api },
      { provide: ReturnsLookupsService, useValue: lookupsSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
    ],
  });
}

describe('ReturnsPortalComponent', () => {
  const api = {
    getReverseLogisticsConfig: vi.fn(),
    getCustomerReturns: vi.fn(),
    getSources: vi.fn(),
    checkEligibility: vi.fn(),
    createCustomerReturn: vi.fn(),
    getReturnLabel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getReverseLogisticsConfig.mockReturnValue(of({ data: rlConfig }));
    api.getCustomerReturns.mockReturnValue(of({ data: [sampleCustomerReturn] }));
    api.getSources.mockReturnValue(of({ data: [sampleSource] }));
    api.checkEligibility.mockReturnValue(of({ data: sampleEligibility }));
    api.createCustomerReturn.mockReturnValue(of({ data: sampleCustomerReturn }));
    api.getReturnLabel.mockReturnValue(of({ data: sampleLabel }));
    setupTestBed(api, ReturnsPortalComponent);
  });

  it('evaluates eligibility and restocking fee, creates an RMA with photos, and displays the barcode label', () => {
    const fixture = TestBed.createComponent(ReturnsPortalComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.form.controls.contact_id.setValue('con-1');
    cmp.form.controls.source_id.setValue('inv-1');
    cmp.form.patchValue({ reason_code: 'right_of_withdrawal', photo_urls_text: 'https://cdn.test/photo1.jpg' });
    cmp.setQuantity('item-1', '1');

    cmp.checkEligibility();
    expect(api.checkEligibility).toHaveBeenCalled();
    expect(cmp.eligibility()?.restocking_fee_amount).toBe('100.00');

    cmp.submitRma();
    expect(api.createCustomerReturn).toHaveBeenCalledWith(expect.objectContaining({
      contact_id: 'con-1',
      invoice_id: 'inv-1',
      photo_urls: ['https://cdn.test/photo1.jpg'],
    }));
    expect(cmp.labelModalVisible()).toBe(true);
    expect(cmp.activeLabel()?.rma_barcode).toBe('RMA-BC-CRMA20270001-123456');
  });
});

describe('ReturnsAdvanceReplacementsComponent', () => {
  const sampleXshp: AdvanceReplacement = {
    id: 'xshp-1',
    replacement_number: 'XSHP-2027-0001',
    customer_return_id: null,
    rma_id: null,
    contact_id: 'con-1',
    customer_name: 'Rossi Srl',
    original_invoice_id: null,
    faulty_product_id: 'prod-1',
    faulty_product_name: 'Laptop X1',
    faulty_serial_number: null,
    replacement_product_id: 'prod-1',
    replacement_product_name: 'Laptop X1',
    replacement_serial_number: null,
    replacement_unit_type: 'new',
    refurbished_item_id: null,
    quantity: '1.0000',
    warehouse_id: 'wh-1',
    status: 'pending_defective_return',
    is_overdue: true,
    shipped_on: '2027-05-01',
    sla_days: 15,
    return_due_on: '2027-05-16',
    defective_received_at: null,
    penalty_amount: '1000.00',
    currency: 'EUR',
    penalty_invoice_id: null,
    penalty_invoice_number: null,
    billed_at: null,
    notes: null,
    created_at: '2027-05-01T09:00:00Z',
  };

  const api = {
    getAdvanceReplacements: vi.fn(),
    createAdvanceReplacement: vi.fn(),
    receiveDefectiveReplacement: vi.fn(),
    billOverdueReplacement: vi.fn(),
    scanOverdueReplacements: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdvanceReplacements.mockReturnValue(of({ data: [sampleXshp] }));
    api.createAdvanceReplacement.mockReturnValue(of({ data: sampleXshp }));
    api.receiveDefectiveReplacement.mockReturnValue(of({ data: { ...sampleXshp, status: 'defective_received' } }));
    api.billOverdueReplacement.mockReturnValue(of({ data: { ...sampleXshp, status: 'overdue_billed' } }));
    api.scanOverdueReplacements.mockReturnValue(of({ data: { billed_count: 1 } }));
    setupTestBed(api, ReturnsAdvanceReplacementsComponent);
  });

  it('creates an advance replacement and handles defective receipt & overdue penalty billing', () => {
    const fixture = TestBed.createComponent(ReturnsAdvanceReplacementsComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.openCreate();
    cmp.form.patchValue({ contact_id: 'con-1', faulty_product_id: 'prod-1', sla_days: 15 });
    cmp.save();
    expect(api.createAdvanceReplacement).toHaveBeenCalled();

    cmp.receiveDefective(sampleXshp);
    expect(api.receiveDefectiveReplacement).toHaveBeenCalledWith('xshp-1');

    cmp.billOverdue(sampleXshp);
    expect(api.billOverdueReplacement).toHaveBeenCalledWith('xshp-1', true);
  });
});

describe('ReturnsGradingBenchComponent', () => {
  const sampleInspection: ReturnGradingInspection = {
    id: 'grd-1',
    inspection_number: 'GRD-2027-0001',
    customer_return_id: 'cr-1',
    customer_return_line_id: null,
    product_id: 'prod-1',
    product_name: 'Laptop X1',
    product_sku: 'LAPTOP-X1',
    serial_number: null,
    quantity_inspected: '1.0000',
    grade: 'grade_b',
    disposition: 'convert_b_stock',
    checklist: { package_intact: false, accessories_complete: true, functional_test_passed: true },
    photo_urls: ['https://cdn.test/grade-b.jpg'],
    original_unit_cost: '500.0000',
    devaluation_percent: '20.00',
    revalued_unit_cost: '400.0000',
    target_warehouse_id: 'wh-1',
    supplier_id: null,
    supplier_return_id: null,
    refurbished_item_id: 'ref-1',
    refurbished_sku: 'LAPTOP-X1-BSTOCK-B-1234',
    inspector_notes: null,
    inspected_at: '2027-06-15T10:00:00Z',
  };

  const sampleRefurbished: RefurbishedItem = {
    id: 'ref-1',
    refurbished_sku: 'LAPTOP-X1-BSTOCK-B-1234',
    original_product_id: 'prod-1',
    original_product_name: 'Laptop X1',
    original_product_sku: 'LAPTOP-X1',
    grade: 'grade_b',
    serial_number: null,
    quantity: '1.0000',
    original_cost: '500.0000',
    devaluation_percent: '20.00',
    refurbishment_cost: '0.0000',
    new_unit_cost: '400.0000',
    suggested_sale_price: '800.0000',
    warehouse_id: 'wh-1',
    work_order_status: 'in_progress',
    work_order_steps: { cleaning: true, testing: true },
    is_available: true,
    notes: null,
    created_at: '2027-06-15T10:00:00Z',
  };

  const api = {
    getGradingInspections: vi.fn(),
    getRefurbishedItems: vi.fn(),
    createGradingInspection: vi.fn(),
    completeRefurbishedWorkOrder: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getGradingInspections.mockReturnValue(of({ data: [sampleInspection] }));
    api.getRefurbishedItems.mockReturnValue(of({ data: [sampleRefurbished] }));
    api.createGradingInspection.mockReturnValue(of({ data: sampleInspection }));
    api.completeRefurbishedWorkOrder.mockReturnValue(of({ data: { ...sampleRefurbished, work_order_status: 'completed' } }));
    setupTestBed(api, ReturnsGradingBenchComponent);
  });

  it('submits Grade B inspection with mandatory photos and completes B-Stock work order', () => {
    const fixture = TestBed.createComponent(ReturnsGradingBenchComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.openCreate();
    cmp.form.patchValue({
      product_id: 'prod-1',
      grade: 'grade_b',
      disposition: 'convert_b_stock',
      photo_urls_text: 'https://cdn.test/grade-b.jpg',
    });
    cmp.save();
    expect(api.createGradingInspection).toHaveBeenCalledWith(expect.objectContaining({
      product_id: 'prod-1',
      grade: 'grade_b',
      photo_urls: ['https://cdn.test/grade-b.jpg'],
    }));

    cmp.completeWorkOrder(sampleRefurbished);
    expect(api.completeRefurbishedWorkOrder).toHaveBeenCalledWith('ref-1', { work_order_status: 'completed' });
  });
});

describe('ReturnsCreditNotesComponent', () => {
  const sampleCheck: CreditNoteFiscalCheckResult = {
    customer_return_id: 'cr-1',
    rma_number: 'CRMA-2027-0001',
    jurisdiction: 'IT',
    original_invoice_id: 'inv-1',
    original_invoice_number: 'INV-2026-001',
    original_invoice_date: '2026-01-10',
    credit_note_date: '2027-06-15',
    days_elapsed: 521,
    art26_one_year_exceeded: true,
    is_commercial_agreement: true,
    vat_recoverable: false,
    proposed_document_type: 'TD04',
    proposed_natura: 'N2.2',
    proposed_tax_rate: '0.00',
    warning_code: 'IT_ART26_OVER_ONE_YEAR_N2_2',
    warning_message: 'Art. 26 DPR 633/72: over 1 year elapsed, N2.2 proposed.',
    dati_fatture_collegate: { id_documento: 'INV-2026-001', data: '2026-01-10', rma_number: 'CRMA-2027-0001' },
    totals: { net: '1000.00', vat: '0.00', gross: '1000.00' },
  };

  const api = {
    getCustomerReturns: vi.fn(),
    checkCreditNoteFiscal: vi.fn(),
    issueReturnCreditNote: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCustomerReturns.mockReturnValue(of({ data: [sampleCustomerReturn] }));
    api.checkCreditNoteFiscal.mockReturnValue(of({ data: sampleCheck }));
    api.issueReturnCreditNote.mockReturnValue(of({
      data: {
        credit_note_id: 'cn-1',
        invoice_number: 'NC-2027-001',
        document_type: 'TD04',
        vat_nature: 'N2.2',
        total_net: '1000.00',
        total_tax: '0.00',
        total_gross: '1000.00',
        customer_return_id: 'cr-1',
      },
    }));
    setupTestBed(api, ReturnsCreditNotesComponent);
  });

  it('detects Art. 26 DPR 633/72 > 1 year and issues TD04 Credit Note with N2.2', () => {
    const fixture = TestBed.createComponent(ReturnsCreditNotesComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.selectedReturnId.set('cr-1');
    cmp.runCheck();

    expect(cmp.checkResult()?.art26_one_year_exceeded).toBe(true);
    expect(cmp.applyN22()).toBe(true);

    cmp.issueCreditNote();
    expect(api.issueReturnCreditNote).toHaveBeenCalledWith(expect.objectContaining({
      customer_return_id: 'cr-1',
      apply_n2_2: true,
    }));
    expect(cmp.issuedNote()?.vat_nature).toBe('N2.2');
  });
});
