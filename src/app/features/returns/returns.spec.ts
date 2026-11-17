import { HttpErrorResponse } from '@angular/common/http';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { ReturnsApiService, ReturnsRma, ReturnsSource, ReturnsSummary, ReturnsSupplierReturn, ReturnsWarranty, ReturnsWarrantyClaim, TranslateService } from '@core';
import { ReturnsClaimsComponent } from './returns-claims.component';
import { ReturnsDashboardComponent } from './returns-dashboard.component';
import { ReturnsLookupsService } from './returns-lookups.service';
import { ReturnsRmaDetailComponent } from './returns-rma-detail.component';
import { ReturnsRmasComponent } from './returns-rmas.component';
import { ReturnsSettingsComponent } from './returns-settings.component';
import { ReturnsSupplierReturnsComponent } from './returns-supplier-returns.component';
import { ReturnsWarrantiesComponent } from './returns-warranties.component';
import { apiErrorText, contactName, oneYearAfter, warrantyColor } from './returns.util';

const rma: ReturnsRma = {
  id: 'rma-1',
  rma_number: 'RMA-2027-0001',
  status: 'received',
  contact_id: 'con-1',
  customer_name: 'Rossi Srl',
  invoice_id: 'inv-1',
  invoice_number: 'INV-1',
  sales_order_id: null,
  warehouse_id: 'wh-1',
  reason_code: 'defective',
  requested_on: '2027-06-10',
  window_overridden: false,
  approved_at: null,
  rejected_at: null,
  rejection_reason: null,
  received_at: null,
  inspected_at: null,
  resolved_at: null,
  closed_at: null,
  resolution_type: null,
  refund_amount: null,
  credit_note_reference: null,
  resolution_notes: null,
  notes: null,
  allowed_transitions: ['inspected'],
  lines: [
    {
      id: 'line-1',
      invoice_item_id: 'item-1',
      sales_order_item_id: null,
      product_id: 'prod-1',
      description: 'Widget',
      quantity: '2.0000',
      quantity_received: '2.0000',
      quantity_inspected: '0.0000',
      unit_price: '99.9000',
      serial_number: 'SN-1',
      lot_number: null,
      reason_code: null,
      disposition: null,
      disposition_warehouse_id: null,
      supplier_id: null,
      inspection_notes: null,
      stock_movement_id: null,
    },
  ],
  created_at: '2027-06-10T09:00:00Z',
  updated_at: '2027-06-10T09:00:00Z',
};

const source: ReturnsSource = {
  type: 'invoice',
  id: 'inv-1',
  number: 'INV-1',
  date: '2027-06-10',
  within_window: false,
  lines: [{ source_item_id: 'item-1', product_id: 'prod-1', description: 'Widget', quantity_sold: '5.0000', quantity_returned: '1.0000', quantity_available: '4.0000', unit_price: '99.9000' }],
};

const warranty: ReturnsWarranty = {
  id: 'war-1',
  product_id: 'prod-1',
  product_name: 'Widget',
  product_sku: 'WID-1',
  contact_id: 'con-1',
  customer_name: 'Rossi Srl',
  invoice_id: null,
  serial_number: 'SN-100',
  lot_number: null,
  starts_on: '2027-01-01',
  ends_on: '2028-01-01',
  coverage_type: 'full',
  coverage_terms: null,
  status: 'active',
  void_reason: null,
  validity: { valid: true, reason: null, checked_on: '2027-06-15', days_left: 200 },
  created_at: '2027-01-01T00:00:00Z',
  updated_at: '2027-01-01T00:00:00Z',
};

const claim: ReturnsWarrantyClaim = {
  id: 'clm-1',
  claim_number: 'CLM-2027-0001',
  warranty_id: 'war-1',
  serial_number: 'SN-100',
  lot_number: null,
  rma_id: null,
  rma_number: null,
  claim_date: '2027-06-15',
  description: 'Does not switch on',
  status: 'open',
  is_valid: false,
  validity_note: 'expired',
  decision_notes: null,
  decided_at: null,
  resolved_at: null,
  created_at: '2027-06-15T00:00:00Z',
  updated_at: '2027-06-15T00:00:00Z',
};

const supplierReturn: ReturnsSupplierReturn = {
  id: 'rtv-1',
  return_number: 'RTV-2027-0001',
  status: 'draft',
  supplier_id: 'sup-1',
  supplier_name: 'Acme Parts',
  warehouse_id: null,
  rma_id: null,
  reason_code: null,
  carrier: null,
  tracking_number: null,
  currency: 'EUR',
  credit_expected: '50.00',
  credit_received: null,
  shipped_at: null,
  credited_at: null,
  closed_at: null,
  cancelled_at: null,
  notes: null,
  allowed_transitions: ['shipped', 'cancelled'],
  lines: [],
  created_at: '2027-06-15T00:00:00Z',
  updated_at: '2027-06-15T00:00:00Z',
};

const summary: ReturnsSummary = {
  period: { from: '2027-01-01', to: '2027-12-31' },
  totals: { rma_count: 3, open_rma_count: 2, refund_value: '200.00', open_warranty_claims: 1, active_warranties: 4, open_supplier_returns: 1, supplier_credit_expected: '50.00' },
  by_reason: [{ reason_code: 'defective', rma_count: 1, quantity: '2.0000' }],
  by_product: [{ product_id: 'prod-1', sku: 'WID-1', name: 'Widget', returned_quantity: '4.0000', sold_quantity: '10.0000', return_rate: '40.00' }],
  ageing: [{ bucket: '0_7', count: 1 }],
  by_status: { requested: 2, approved: 0, received: 0, inspected: 0, resolved: 1, rejected: 0, closed: 0 },
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const lookupsSpy = {
  customers: () => [{ id: 'con-1', label: 'Rossi Srl' }],
  suppliers: () => [{ id: 'sup-1', label: 'Acme Parts' }],
  products: () => [{ id: 'prod-1', label: 'WID-1 - Widget', costPrice: '40' }],
  warehouses: () => [{ id: 'wh-1', label: 'MAIN - Main warehouse' }],
  reasons: () => [{ id: 'r1', code: 'defective', label: 'Defective', is_defect: true, is_active: true }],
  searchCustomers: vi.fn(),
  searchProducts: vi.fn(),
  loadSuppliers: vi.fn(),
  loadWarehouses: vi.fn(),
  loadReasons: vi.fn(),
};

function configure(api: Record<string, unknown>, component: Type<unknown>, routeId = 'rma-1'): void {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      { provide: ReturnsApiService, useValue: api },
      { provide: ReturnsLookupsService, useValue: lookupsSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => routeId } } } },
      provideNzIcons(icons),
    ],
  });
}

describe('ReturnsDashboardComponent', () => {
  const api = { getSummary: vi.fn(), getSettings: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getSummary.mockReturnValue(of({ data: summary }));
    api.getSettings.mockReturnValue(of({ data: { return_window_days: 30, reason_codes: [{ id: 'r1', code: 'defective', label: 'Defective', is_defect: true, is_active: true }] } }));
    configure(api, ReturnsDashboardComponent);
  });

  it('loads the summary of the period, names the reasons and fills the missing ageing buckets', () => {
    const fixture = TestBed.createComponent(ReturnsDashboardComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getSummary).toHaveBeenCalledWith({ from: expect.stringMatching(/^\d{4}-01-01$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(component.reasonLabel('defective')).toBe('Defective');
    expect(component.reasonLabel('other')).toBe('other');
    expect(component.ageing().map((row) => [row.bucket, row.count])).toEqual([['0_7', 1], ['8_30', 0], ['31_60', 0], ['over_60', 0]]);
  });

  it('reloads when the period changes and reports an API failure', () => {
    const fixture = TestBed.createComponent(ReturnsDashboardComponent);
    fixture.detectChanges();
    api.getSummary.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { to: ['Bad range'] } } })));

    fixture.componentInstance.to.set('2020-01-01');
    fixture.componentInstance.load();

    expect(messageSpy.error).toHaveBeenCalledWith('Bad range');
  });
});

describe('ReturnsRmasComponent', () => {
  const api = { getRmas: vi.fn(), getSources: vi.fn(), createRma: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getRmas.mockReturnValue(of({ data: [rma] }));
    api.getSources.mockReturnValue(of({ data: [source] }));
    api.createRma.mockReturnValue(of({ data: rma }));
    configure(api, ReturnsRmasComponent);
  });

  it('lists the returns with the status filter', () => {
    const fixture = TestBed.createComponent(ReturnsRmasComponent);
    fixture.detectChanges();
    fixture.componentInstance.statusFilter.set('approved');
    fixture.componentInstance.load();

    expect(fixture.componentInstance.rmas()).toEqual([rma]);
    expect(api.getRmas).toHaveBeenLastCalledWith({ status: 'approved', search: undefined, per_page: 100 });
  });

  it('loads the sources of the customer and requests a return with only the lines that got a quantity', () => {
    const fixture = TestBed.createComponent(ReturnsRmasComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.openModal();
    component.form.controls.contact_id.setValue('con-1');
    expect(api.getSources).toHaveBeenCalledWith('con-1');
    component.form.controls.source_id.setValue('inv-1');
    component.form.patchValue({ reason_code: 'defective', requested_on: '2027-06-15', override_window: true });
    expect(component.selectedSource()?.within_window).toBe(false);
    expect(component.hasLines()).toBe(false);

    component.setQuantity('item-1', '2');
    expect(component.hasLines()).toBe(true);
    component.save();

    expect(api.createRma).toHaveBeenCalledWith({
      contact_id: 'con-1',
      invoice_id: 'inv-1',
      sales_order_id: null,
      reason_code: 'defective',
      requested_on: '2027-06-15',
      override_window: true,
      notes: null,
      lines: [{ invoice_item_id: 'item-1', quantity: 2 }],
    });
    expect(navigate).toHaveBeenCalledWith(['/returns/rmas', 'rma-1']);
    expect(component.modalVisible()).toBe(false);
  });

  it('sends the lines of an order as order lines and shows the reason of a refusal', () => {
    api.getSources.mockReturnValue(of({ data: [{ ...source, type: 'sales_order', id: 'so-1' }] }));
    api.createRma.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { 'lines.0.quantity': ['Only 4 can still be returned'] } } })));
    const fixture = TestBed.createComponent(ReturnsRmasComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.controls.contact_id.setValue('con-1');
    component.form.controls.source_id.setValue('so-1');
    component.form.patchValue({ reason_code: 'defective' });
    component.setQuantity('item-1', '9');
    component.save();

    expect(api.createRma).toHaveBeenCalledWith(expect.objectContaining({ invoice_id: null, sales_order_id: 'so-1', lines: [{ sales_order_item_id: 'item-1', quantity: 9 }] }));
    expect(messageSpy.error).toHaveBeenCalledWith('Only 4 can still be returned');
  });
});

describe('ReturnsRmaDetailComponent', () => {
  const api = { getRma: vi.fn(), approveRma: vi.fn(), rejectRma: vi.fn(), receiveRma: vi.fn(), inspectRma: vi.fn(), resolveRma: vi.fn(), closeRma: vi.fn(), updateRma: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getRma.mockReturnValue(of({ data: rma }));
    configure(api, ReturnsRmaDetailComponent);
  });

  it('offers only the actions the status machine of the API allows', () => {
    const fixture = TestBed.createComponent(ReturnsRmaDetailComponent);
    fixture.detectChanges();

    expect(api.getRma).toHaveBeenCalledWith('rma-1');
    expect(fixture.componentInstance.can('inspected')).toBe(true);
    expect(fixture.componentInstance.can('resolved')).toBe(false);
    expect(fixture.componentInstance.can('rejected')).toBe(false);
  });

  it('edits a requested return with a partial update', () => {
    api.updateRma.mockReturnValue(of({ data: { ...rma, status: 'requested', notes: 'new' } }));
    const fixture = TestBed.createComponent(ReturnsRmaDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDialog('edit');
    expect(component.editForm.getRawValue().reason_code).toBe(rma.reason_code);
    component.editForm.patchValue({ notes: 'new' });
    component.submit();

    expect(api.updateRma).toHaveBeenCalledWith('rma-1', expect.objectContaining({ notes: 'new' }));
    expect(component.dialog()).toBeNull();
  });

  it('inspects the received lines with one disposition each and refuses a supplier return without a supplier', () => {
    api.inspectRma.mockReturnValue(of({ data: { ...rma, status: 'inspected' } }));
    const fixture = TestBed.createComponent(ReturnsRmaDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDialog('inspect');
    expect(component.inspectRows()).toHaveLength(1);
    expect(component.dialogValid()).toBe(true);

    component.setInspect('line-1', 'disposition', 'return_to_supplier');
    expect(component.dialogValid()).toBe(false);
    component.setInspect('line-1', 'supplier_id', 'sup-1');
    component.setInspect('line-1', 'quantity_inspected', '1');
    expect(component.dialogValid()).toBe(true);

    component.submit();

    expect(api.inspectRma).toHaveBeenCalledWith('rma-1', [{ id: 'line-1', quantity_inspected: 1, disposition: 'return_to_supplier', warehouse_id: null, supplier_id: 'sup-1', notes: null }]);
    expect(component.rma()?.status).toBe('inspected');
    expect(component.dialog()).toBeNull();
  });

  it('receives the given quantities and shows the validation message of the API', () => {
    api.receiveRma.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { lines: ['Received too much'] } } })));
    const fixture = TestBed.createComponent(ReturnsRmaDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDialog('receive');
    component.setReceived('line-1', '1');
    component.submit();

    expect(api.receiveRma).toHaveBeenCalledWith('rma-1', { warehouse_id: 'wh-1', lines: [{ id: 'line-1', quantity_received: 1 }] });
    expect(messageSpy.error).toHaveBeenCalledWith('Received too much');
    expect(component.dialog()).toBe('receive');
  });

  it('needs the credit note reference to resolve with a credit note', () => {
    api.resolveRma.mockReturnValue(of({ data: { ...rma, status: 'resolved' } }));
    const fixture = TestBed.createComponent(ReturnsRmaDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDialog('resolve');
    expect(component.dialogValid()).toBe(true);
    component.resolveForm.patchValue({ resolution_type: 'credit_note', refund_amount: '150' });
    expect(component.dialogValid()).toBe(false);
    component.resolveForm.patchValue({ credit_note_reference: 'CN-DRAFT-1' });
    expect(component.dialogValid()).toBe(true);
    component.submit();

    expect(api.resolveRma).toHaveBeenCalledWith('rma-1', { resolution_type: 'credit_note', refund_amount: 150, credit_note_reference: 'CN-DRAFT-1', warehouse_id: null, notes: null });
  });

  it('rejects with a reason and closes', () => {
    api.rejectRma.mockReturnValue(of({ data: { ...rma, status: 'rejected' } }));
    api.closeRma.mockReturnValue(of({ data: { ...rma, status: 'closed' } }));
    const fixture = TestBed.createComponent(ReturnsRmaDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDialog('reject');
    expect(component.dialogValid()).toBe(false);
    component.rejectForm.patchValue({ reason: 'Not covered' });
    expect(component.dialogValid()).toBe(true);
    component.submit();
    expect(api.rejectRma).toHaveBeenCalledWith('rma-1', 'Not covered');

    component.close();
    expect(api.closeRma).toHaveBeenCalledWith('rma-1');
    expect(component.rma()?.status).toBe('closed');
  });
});

describe('ReturnsWarrantiesComponent', () => {
  const api = { getWarranties: vi.fn(), createWarranty: vi.fn(), updateWarranty: vi.fn(), voidWarranty: vi.fn(), checkWarrantyValidity: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getWarranties.mockReturnValue(of({ data: [warranty] }));
    api.createWarranty.mockReturnValue(of({ data: warranty }));
    api.voidWarranty.mockReturnValue(of({ data: { ...warranty, status: 'void' } }));
    api.checkWarrantyValidity.mockReturnValue(of({ data: { valid: false, reason: 'expired', checked_on: '2028-02-01', days_left: 0 } }));
    configure(api, ReturnsWarrantiesComponent);
  });

  it('asks the API for the expiring and the expired warranties', () => {
    const fixture = TestBed.createComponent(ReturnsWarrantiesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.view.set('expiring60');
    component.load();
    expect(api.getWarranties).toHaveBeenLastCalledWith({ search: undefined, expiring: 60, expired: undefined, per_page: 100 });

    component.view.set('expired');
    component.load();
    expect(api.getWarranties).toHaveBeenLastCalledWith({ search: undefined, expiring: undefined, expired: true, per_page: 100 });
  });

  it('registers a warranty with a serial number and the default one-year period', () => {
    const fixture = TestBed.createComponent(ReturnsWarrantiesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCreate();
    component.form.patchValue({ product_id: 'prod-1', contact_id: 'con-1', serial_number: 'SN-9', starts_on: '2027-06-15', ends_on: '2028-06-15' });
    component.save();

    expect(api.createWarranty).toHaveBeenCalledWith({
      product_id: 'prod-1',
      contact_id: 'con-1',
      serial_number: 'SN-9',
      lot_number: null,
      starts_on: '2027-06-15',
      ends_on: '2028-06-15',
      coverage_type: 'full',
      coverage_terms: null,
    });
    expect(component.createVisible()).toBe(false);
  });

  it('warns when the validity check says the warranty does not cover and voids with a reason', () => {
    const fixture = TestBed.createComponent(ReturnsWarrantiesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.check(warranty);
    expect(messageSpy.warning).toHaveBeenCalledWith('RETURNS.WARRANTY_EXPIRED');

    component.openVoid(warranty);
    component.voidReason.set('Registered by mistake');
    component.confirmVoid();
    expect(api.voidWarranty).toHaveBeenCalledWith('war-1', 'Registered by mistake');
    expect(component.voidVisible()).toBe(false);
  });
});

describe('ReturnsClaimsComponent', () => {
  const api = { getClaims: vi.fn(), getWarranties: vi.fn(), getRmas: vi.fn(), createClaim: vi.fn(), acceptClaim: vi.fn(), rejectClaim: vi.fn(), resolveClaim: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getClaims.mockReturnValue(of({ data: [claim] }));
    api.getWarranties.mockReturnValue(of({ data: [warranty] }));
    api.getRmas.mockReturnValue(of({ data: [rma] }));
    api.createClaim.mockReturnValue(of({ data: claim }));
    api.acceptClaim.mockReturnValue(of({ data: { ...claim, status: 'accepted' } }));
    api.rejectClaim.mockReturnValue(of({ data: { ...claim, status: 'rejected' } }));
    api.resolveClaim.mockReturnValue(of({ data: { ...claim, status: 'resolved' } }));
    configure(api, ReturnsClaimsComponent);
  });

  it('raises a claim on a warranty linked to a return of the same customer and warns about an uncovered one', () => {
    const fixture = TestBed.createComponent(ReturnsClaimsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCreate();
    component.form.controls.warranty_id.setValue('war-1');
    expect(api.getRmas).toHaveBeenCalledWith({ contact_id: 'con-1', per_page: 100 });
    component.form.patchValue({ rma_id: 'rma-1', claim_date: '2027-06-15', description: 'Does not switch on' });
    component.save();

    expect(api.createClaim).toHaveBeenCalledWith({ warranty_id: 'war-1', rma_id: 'rma-1', claim_date: '2027-06-15', description: 'Does not switch on' });
    expect(messageSpy.warning).toHaveBeenCalledWith('RETURNS.CLAIM_NOT_COVERED');
  });

  it('accepts an uncovered claim with the override and rejects with the reason', () => {
    const fixture = TestBed.createComponent(ReturnsClaimsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDialog('accept', claim);
    component.override.set(true);
    component.notes.set('Goodwill');
    component.submitDialog();
    expect(api.acceptClaim).toHaveBeenCalledWith('clm-1', { notes: 'Goodwill', override_validity: true });

    component.openDialog('reject', claim);
    component.notes.set('Water damage');
    component.submitDialog();
    expect(api.rejectClaim).toHaveBeenCalledWith('clm-1', 'Water damage');

    component.resolve({ ...claim, status: 'accepted' });
    expect(api.resolveClaim).toHaveBeenCalledWith('clm-1');
  });
});

describe('ReturnsSupplierReturnsComponent', () => {
  const api = {
    getSupplierReturns: vi.fn(),
    createSupplierReturn: vi.fn(),
    updateSupplierReturn: vi.fn(),
    shipSupplierReturn: vi.fn(),
    creditSupplierReturn: vi.fn(),
    closeSupplierReturn: vi.fn(),
    cancelSupplierReturn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getSupplierReturns.mockReturnValue(of({ data: [supplierReturn] }));
    api.createSupplierReturn.mockReturnValue(of({ data: supplierReturn }));
    api.updateSupplierReturn.mockReturnValue(of({ data: supplierReturn }));
    api.shipSupplierReturn.mockReturnValue(of({ data: { ...supplierReturn, status: 'shipped' } }));
    api.creditSupplierReturn.mockReturnValue(of({ data: { ...supplierReturn, status: 'credited' } }));
    api.closeSupplierReturn.mockReturnValue(of({ data: { ...supplierReturn, status: 'closed' } }));
    api.cancelSupplierReturn.mockReturnValue(of({ data: { ...supplierReturn, status: 'cancelled' } }));
    configure(api, ReturnsSupplierReturnsComponent);
  });

  it('edits a draft supplier return through the update endpoint', () => {
    const fixture = TestBed.createComponent(ReturnsSupplierReturnsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openEdit(supplierReturn);
    expect(component.editingId()).toBe(supplierReturn.id);
    component.form.patchValue({ carrier: 'DHL' });
    component.save();

    expect(api.updateSupplierReturn).toHaveBeenCalledWith(supplierReturn.id, expect.objectContaining({ carrier: 'DHL', supplier_id: 'sup-1' }));
    expect(api.createSupplierReturn).not.toHaveBeenCalled();
  });

  it('shows the actions of the status machine and drafts a return with its lines', () => {
    const fixture = TestBed.createComponent(ReturnsSupplierReturnsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.allows(supplierReturn, 'shipped')).toBe(true);
    expect(component.allows(supplierReturn, 'credited')).toBe(false);

    component.openCreate();
    component.form.patchValue({ supplier_id: 'sup-1', reason_code: 'defective', carrier: 'UPS' });
    expect(component.hasLines()).toBe(false);
    component.setLine(0, 'product_id', 'prod-1');
    component.setLine(0, 'quantity', '4');
    component.setLine(0, 'unit_cost', '12.5');
    component.addLine();
    expect(component.hasLines()).toBe(false);
    component.removeLine(1);
    expect(component.hasLines()).toBe(true);
    component.save();

    expect(api.createSupplierReturn).toHaveBeenCalledWith({
      supplier_id: 'sup-1',
      reason_code: 'defective',
      carrier: 'UPS',
      tracking_number: null,
      credit_expected: null,
      lines: [{ product_id: 'prod-1', quantity: 4, unit_cost: 12.5 }],
    });
    expect(component.createVisible()).toBe(false);
  });

  it('ships with the tracking number, records the credit, closes and cancels', () => {
    const fixture = TestBed.createComponent(ReturnsSupplierReturnsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDialog('ship', supplierReturn);
    component.shipCarrier.set('DHL');
    component.shipTracking.set('TRK-123');
    component.submitDialog();
    expect(api.shipSupplierReturn).toHaveBeenCalledWith('rtv-1', { warehouse_id: null, carrier: 'DHL', tracking_number: 'TRK-123' });

    component.openDialog('credit', { ...supplierReturn, status: 'shipped' });
    component.creditReceived.set('24.5');
    component.submitDialog();
    expect(api.creditSupplierReturn).toHaveBeenCalledWith('rtv-1', 24.5);

    component.close(supplierReturn);
    expect(api.closeSupplierReturn).toHaveBeenCalledWith('rtv-1');
    component.cancel(supplierReturn);
    expect(api.cancelSupplierReturn).toHaveBeenCalledWith('rtv-1');
  });
});

describe('ReturnsSettingsComponent', () => {
  const api = { getSettings: vi.fn(), updateSettings: vi.fn(), createReasonCode: vi.fn(), updateReasonCode: vi.fn(), deleteReasonCode: vi.fn() };
  const reason = { id: 'r1', code: 'defective', label: 'Defective', is_defect: true, is_active: true };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getSettings.mockReturnValue(of({ data: { return_window_days: 14, reason_codes: [reason] } }));
    api.updateSettings.mockReturnValue(of({ data: { return_window_days: 45, reason_codes: [reason] } }));
    api.createReasonCode.mockReturnValue(of({ data: reason }));
    api.updateReasonCode.mockReturnValue(of({ data: reason }));
    configure(api, ReturnsSettingsComponent);
  });

  it('loads the window and the reason codes and saves a new window', () => {
    const fixture = TestBed.createComponent(ReturnsSettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.windowForm.getRawValue().return_window_days).toBe(14);
    expect(component.reasons()).toEqual([reason]);

    component.windowForm.patchValue({ return_window_days: 45 });
    component.saveWindow();
    expect(api.updateSettings).toHaveBeenCalledWith(45);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('validates the code of a reason, keeps it fixed on edit and tells a deactivation from a deletion', () => {
    const fixture = TestBed.createComponent(ReturnsSettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCreate();
    component.reasonForm.patchValue({ code: 'Bad Code', label: 'Recall' });
    expect(component.reasonForm.invalid).toBe(true);
    component.reasonForm.patchValue({ code: 'recalled', is_defect: true });
    component.saveReason();
    expect(api.createReasonCode).toHaveBeenCalledWith({ code: 'recalled', label: 'Recall', is_defect: true, is_active: true });

    component.openEdit(reason);
    expect(component.reasonForm.controls.code.disabled).toBe(true);
    component.reasonForm.patchValue({ label: 'Broken' });
    component.saveReason();
    expect(api.updateReasonCode).toHaveBeenCalledWith('r1', { label: 'Broken', is_defect: true, is_active: true });

    api.deleteReasonCode.mockReturnValue(of({ deleted: false }));
    component.remove(reason);
    expect(messageSpy.success).toHaveBeenLastCalledWith('RETURNS.REASON_DEACTIVATED');
    api.deleteReasonCode.mockReturnValue(of({ deleted: true }));
    component.remove(reason);
    expect(messageSpy.success).toHaveBeenLastCalledWith('RETURNS.REASON_DELETED');
  });
});

describe('returns utilities', () => {
  it('extracts the first validation message of the API', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { a: ['First'] }, message: 'Summary' } }))).toBe('First');
    expect(apiErrorText(new HttpErrorResponse({ status: 500, error: { message: 'Boom' } }))).toBe('Boom');
    expect(apiErrorText(new Error('x'))).toBeNull();
  });

  it('names contacts and ends a warranty one year later', () => {
    expect(contactName({ company_name: 'Rossi Srl', first_name: 'Mario', last_name: 'Rossi' })).toBe('Rossi Srl');
    expect(contactName({ company_name: null, first_name: 'Mario', last_name: 'Rossi' })).toBe('Mario Rossi');
    expect(oneYearAfter('2027-06-15')).toBe('2028-06-15');
    expect(oneYearAfter('2028-02-29')).toBe('2029-03-01');
  });

  it('colours a warranty by what is left of it', () => {
    expect(warrantyColor(warranty)).toBe('green');
    expect(warrantyColor({ ...warranty, validity: { ...warranty.validity, days_left: 10 } })).toBe('orange');
    expect(warrantyColor({ ...warranty, validity: { valid: false, reason: 'expired', checked_on: '2028-02-01', days_left: 0 } })).toBe('red');
  });
});
