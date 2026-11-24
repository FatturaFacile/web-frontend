import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmServiceReport, FsmWorkOrderDetail } from '@core';
import { ClientApiService, FsmApiService, I18nService, InventoryApiService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { partLineTotal, WorkOrderDetailComponent } from './work-order-detail.component';

const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('@shared/utils/download-blob', () => ({ downloadBlob }));

interface Harness {
  order: () => FsmWorkOrderDetail | null;
  chargeableTotal: () => number;
  chargeableParts: () => unknown[];
  coveredParts: () => unknown[];
  canRecordParts: () => boolean;
  canInvoice: () => boolean;
  canSign: () => boolean;
  canCompleteAndBill: () => boolean;
  settleForm: { patchValue(value: object): void };
  openSettle(): void;
  completeAndBill(): void;
  signOpen: { (): boolean; set(value: boolean): void };
  nextStep: () => string | null;
  signatureSrc: () => string | null;
  partForm: { patchValue(value: object): void };
  invoiceForm: { patchValue(value: object): void };
  advance(): void;
  recordPart(): void;
  downloadPdf(): void;
  openInvoice(): void;
  openSign(): void;
  onSigned(): void;
  convertToInvoice(): void;
}

const report: FsmServiceReport = {
  id: 'r1',
  work_order_id: 'w1',
  report_number: 'SR-1',
  work_performed_summary: 'Replaced the pump',
  checklist: [{ item: 'Leak test', result: 'pass' }],
  labor_hours: '2.00',
  travel_hours: '0.50',
  travel_km: '12.0',
  apply_callout_fee: true,
  meter_reading_hours: '120.0',
  meter_reading_cycles: 40,
  customer_signer_name: 'Rossi',
  customer_signer_role: null,
  signature_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  signature_sha256_hash: 'abc',
  signature_intact: true,
  signed_at: '2026-03-02T10:00:00+00:00',
  gps_latitude: null,
  gps_longitude: null,
  photos: [],
  locale: 'en',
  has_pdf: true,
  emailed_at: null,
  invoice_id: null,
  billing: {
    currency: 'EUR',
    billable_total: '60.00',
    covered_total: '30.00',
    lines: [
      { kind: 'labor', description: 'labor', quantity: '2.00', unit_price: '30.00', list_amount: '60.00', charged_amount: '60.00', covered: false, product_id: null },
      { kind: 'part', description: 'Pump', quantity: '1', unit_price: '30.00', list_amount: '30.00', charged_amount: '0.00', covered: true, product_id: 'p1' },
    ],
  },
};

function workOrder(overrides: Partial<FsmWorkOrderDetail> = {}): FsmWorkOrderDetail {
  return {
    id: 'w1',
    work_order_number: 'WO-1',
    work_order_type: 'corrective',
    status: 'on_site',
    priority: 'normal',
    title: 'Pump failure',
    problem_description: null,
    customer_id: 'c1',
    equipment_passport_id: null,
    service_contract_id: 'k1',
    assigned_technician_id: 't1',
    required_skills: ['hvac'],
    required_parts: [],
    scheduled_start: '2026-03-02T08:00:00+00:00',
    scheduled_end: '2026-03-02T10:00:00+00:00',
    actual_arrival: null,
    actual_completion: null,
    site: { address: 'Zurich' },
    client_uuid: null,
    invoice_id: null,
    parts: [
      { id: 'a', product_id: 'p1', description: 'Pump', quantity: '1', unit_price: '0.00', covered: true, warehouse_id: 'v', stock_movement_id: 'm1' },
      { id: 'b', product_id: 'p2', description: 'Filter', quantity: '2', unit_price: '15.00', covered: false, warehouse_id: 'v', stock_movement_id: 'm2' },
    ],
    service_report: null,
    ...overrides,
  };
}

describe('WorkOrderDetailComponent', () => {
  let fixture: ComponentFixture<WorkOrderDetailComponent>;
  let harness: Harness;

  const api = {
    getWorkOrder: vi.fn(),
    advanceStatus: vi.fn(),
    recordPart: vi.fn(),
    downloadReportPdf: vi.fn(),
    invoiceReport: vi.fn(),
    signReport: vi.fn(),
    completeAndBill: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  async function create(order: FsmWorkOrderDetail, canWrite = true): Promise<void> {
    api.getWorkOrder.mockReturnValue(of({ data: order }));
    await TestBed.configureTestingModule({
      imports: [WorkOrderDetailComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'w1' }) } } },
        { provide: FsmApiService, useValue: api },
        { provide: ClientApiService, useValue: { list: () => of({ data: [] }) } },
        { provide: InventoryApiService, useValue: { getProducts: () => of({ data: [] }) } },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkOrderDetailComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.advanceStatus.mockReturnValue(of({ data: {} }));
    api.recordPart.mockReturnValue(of({ data: { id: 'x', covered: true, unit_price: '0.00', stock_movement_id: null } }));
    api.downloadReportPdf.mockReturnValue(of(new Blob(['pdf'])));
    api.invoiceReport.mockReturnValue(of({ data: { invoice_id: 'i1' } }));
    api.completeAndBill.mockReturnValue(of({ data: { settlement: 'invoice_draft', invoice_id: 'i2', ticket_status: 'resolved', hours_deducted: '0.00' } }));
  });

  it('computes part line totals', () => {
    expect(partLineTotal({ quantity: '2', unit_price: '15.00' })).toBe(30);
  });

  it('keeps covered and chargeable part lines apart', async () => {
    await create(workOrder());
    expect(api.getWorkOrder).toHaveBeenCalledWith('w1');
    expect(harness.coveredParts()).toHaveLength(1);
    expect(harness.chargeableParts()).toHaveLength(1);
    expect(harness.chargeableTotal()).toBe(30);
    expect(el().querySelectorAll('[data-testid="covered-tag"]')).toHaveLength(1);
    expect(el().querySelectorAll('[data-testid="chargeable-tag"]')).toHaveLength(1);
    expect(el().querySelector('[data-testid="covered-count"]')?.textContent).toContain('1');
  });

  it('offers the next journey step and records a van part while the technician is working', async () => {
    await create(workOrder({ status: 'dispatched' }));
    expect(harness.nextStep()).toBe('en_route');
    expect(harness.canRecordParts()).toBe(true);
    harness.advance();
    expect(api.advanceStatus).toHaveBeenCalledWith('w1', { status: 'en_route' });

    harness.partForm.patchValue({ product_id: 'p9', quantity: 3 });
    harness.recordPart();
    expect(api.recordPart).toHaveBeenCalledWith('w1', expect.objectContaining({ product_id: 'p9', quantity: 3, unit_price: null }));
    expect(message.success).toHaveBeenCalledWith('FSM.WO.PART_RECORDED_COVERED');
  });

  it('rejects an incomplete part and hides the actions of a completed order', async () => {
    await create(workOrder({ status: 'completed', service_report: report }));
    expect(harness.canRecordParts()).toBe(false);
    expect(harness.nextStep()).toBeNull();
    harness.recordPart();
    expect(api.recordPart).not.toHaveBeenCalled();
  });

  it('views the signed report, its seal and its priced lines', async () => {
    await create(workOrder({ status: 'completed', service_report: report }));
    expect(el().textContent).toContain('SR-1');
    expect(el().querySelector('[data-testid="seal-ok"]')).not.toBeNull();
    expect(el().querySelectorAll('[data-testid="billing-table"] tbody tr')).toHaveLength(2);
    expect(harness.signatureSrc()).toContain('data:image/svg+xml');
    expect(el().querySelector('img.wod-signature')).not.toBeNull();
  });

  it('flags a broken seal and an order without a report', async () => {
    await create(workOrder({ status: 'completed', service_report: { ...report, signature_intact: false } }));
    expect(el().querySelector('[data-testid="seal-broken"]')).not.toBeNull();
  });

  it('shows an empty state when no report was signed', async () => {
    await create(workOrder());
    expect(el().querySelector('[data-testid="no-report"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="download-pdf"]')).toBeNull();
  });

  it('downloads the report PDF with the report number as the file name', async () => {
    await create(workOrder({ status: 'completed', service_report: report }));
    harness.downloadPdf();
    expect(api.downloadReportPdf).toHaveBeenCalledWith('r1');
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'SR-1.pdf');
  });

  it('completes and bills an intervention that is still on site', async () => {
    await create(workOrder({ status: 'on_site' }));
    expect(harness.canCompleteAndBill()).toBe(true);
    expect(el().querySelector('[data-testid="complete-and-bill"]')).not.toBeNull();

    harness.openSettle();
    harness.settleForm.patchValue({ tax_rate: 8.1, completion_notes: 'Pump replaced', due_date: '2026-12-31' });
    harness.completeAndBill();

    expect(api.completeAndBill).toHaveBeenCalledWith('w1', {
      tax_rate: 8.1,
      completion_notes: 'Pump replaced',
      resolution_summary: null,
      signed_by_customer_name: null,
      due_date: '2026-12-31',
    });
    expect(message.success).toHaveBeenCalledWith('FSM.WO.SETTLED_INVOICE_DRAFT');
    expect(api.getWorkOrder).toHaveBeenCalledTimes(2);
  });

  it('hides complete-and-bill outside on_site or without write access', async () => {
    await create(workOrder({ status: 'completed' }));
    expect(harness.canCompleteAndBill()).toBe(false);
    TestBed.resetTestingModule();

    await create(workOrder({ status: 'on_site' }), false);
    expect(harness.canCompleteAndBill()).toBe(false);
  });

  it('converts the report to an invoice with the chosen tax rate', async () => {
    await create(workOrder({ status: 'completed', service_report: report }));
    expect(harness.canInvoice()).toBe(true);
    expect(el().querySelector('[data-testid="convert-invoice"]')).not.toBeNull();

    harness.openInvoice();
    harness.invoiceForm.patchValue({ tax_rate: 8.1 });
    harness.convertToInvoice();

    expect(api.invoiceReport).toHaveBeenCalledWith('r1', { tax_rate: 8.1 });
    expect(message.success).toHaveBeenCalledWith('FSM.REPORT.INVOICED');
  });

  it('does not offer the invoice when everything is covered, already invoiced or the user cannot write', async () => {
    await create(
      workOrder({ status: 'completed', service_report: { ...report, billing: { ...report.billing, billable_total: '0.00' } } }),
    );
    expect(harness.canInvoice()).toBe(false);
    TestBed.resetTestingModule();

    await create(workOrder({ status: 'invoiced', service_report: { ...report, invoice_id: 'i1' } }));
    expect(harness.canInvoice()).toBe(false);
    expect(el().querySelector('[data-testid="invoiced-alert"]')).not.toBeNull();
    TestBed.resetTestingModule();

    await create(workOrder({ status: 'completed', service_report: report }), false);
    expect(harness.canInvoice()).toBe(false);
  });

  it('reports a failing invoice conversion', async () => {
    api.invoiceReport.mockReturnValue(throwError(() => new Error('boom')));
    await create(workOrder({ status: 'completed', service_report: report }));
    harness.convertToInvoice();
    expect(message.success).not.toHaveBeenCalled();
  });

  it('offers sign and close only to a writer while the technician is on site and nothing is signed', async () => {
    await create(workOrder({ status: 'on_site' }));
    expect(harness.canSign()).toBe(true);
    expect(el().querySelector('[data-testid="sign-report"]')).not.toBeNull();
    harness.openSign();
    expect(harness.signOpen()).toBe(true);
    TestBed.resetTestingModule();

    await create(workOrder({ status: 'en_route' }));
    expect(harness.canSign()).toBe(false);
    expect(el().querySelector('[data-testid="sign-report"]')).toBeNull();
    TestBed.resetTestingModule();

    await create(workOrder({ status: 'on_site', service_report: report }));
    expect(harness.canSign()).toBe(false);
    TestBed.resetTestingModule();

    await create(workOrder({ status: 'on_site' }), false);
    expect(harness.canSign()).toBe(false);
    expect(el().querySelector('[data-testid="sign-report"]')).toBeNull();
  });

  it('reloads the work order once the report is signed', async () => {
    await create(workOrder({ status: 'on_site' }));
    api.getWorkOrder.mockClear();
    harness.onSigned();
    expect(api.getWorkOrder).toHaveBeenCalledWith('w1');
  });
});
