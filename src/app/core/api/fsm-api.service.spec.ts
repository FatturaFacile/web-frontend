import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FsmApiService } from './fsm-api.service';

describe('FsmApiService', () => {
  const base = `${environment.apiBaseUrl}/fsm`;
  let api: FsmApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(FsmApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the dispatcher board for a window', () => {
    api.getBoard({ from: '2026-03-01T00:00:00Z', to: '2026-03-08T00:00:00Z' }).subscribe();
    const req = http.expectOne(
      (r) =>
        r.url === `${base}/board` &&
        r.params.get('from') === '2026-03-01T00:00:00Z' &&
        r.params.get('to') === '2026-03-08T00:00:00Z',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: { window: { from: '', to: '' }, unassigned: [], lanes: [] } });
  });

  it('dispatches a work order to a technician', () => {
    const payload = {
      technician_id: 't1',
      scheduled_start: '2026-03-02T10:00:00Z',
      scheduled_end: '2026-03-02T12:00:00Z',
    };
    api.dispatch('w1', payload).subscribe();
    const req = http.expectOne(`${base}/work-orders/w1/dispatch`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: {} });
  });

  it('lists, reads and creates work orders', () => {
    api.listWorkOrders({ status: 'completed', work_order_type: '' }).subscribe();
    const list = http.expectOne((r) => r.url === `${base}/work-orders` && r.params.get('status') === 'completed');
    expect(list.request.params.has('work_order_type')).toBe(false);
    list.flush({ data: [] });

    api.getWorkOrder('w1').subscribe();
    http.expectOne(`${base}/work-orders/w1`).flush({ data: {} });

    const payload = { work_order_type: 'corrective' as const, customer_id: 'c1', title: 'Leak' };
    api.createWorkOrder(payload).subscribe();
    const create = http.expectOne(`${base}/work-orders`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });
  });

  it('advances the status and records a van part', () => {
    api.advanceStatus('w1', { status: 'en_route' }).subscribe();
    const status = http.expectOne(`${base}/work-orders/w1/status`);
    expect(status.request.body).toEqual({ status: 'en_route' });
    status.flush({ data: {} });

    api.recordPart('w1', { product_id: 'p1', quantity: 2 }).subscribe();
    const part = http.expectOne(`${base}/work-orders/w1/parts`);
    expect(part.request.method).toBe('POST');
    expect(part.request.body).toEqual({ product_id: 'p1', quantity: 2 });
    part.flush({ data: {} });
  });

  it('signs a service report with a POST to the work order', () => {
    const payload = {
      work_performed_summary: 'Done',
      labor_hours: 1.5,
      customer_signer_name: 'Rossi',
      signature_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      signed_at: '2026-03-02T10:00:00.000Z',
    };
    api.signReport('w1', payload).subscribe();
    const req = http.expectOne(`${base}/work-orders/w1/service-report`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: {} });
  });

  it('downloads the report PDF as a blob and converts it to an invoice', () => {
    api.downloadReportPdf('r1').subscribe();
    const pdf = http.expectOne(`${base}/service-reports/r1/pdf`);
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['x']));

    api.invoiceReport('r1', { tax_rate: 22 }).subscribe();
    const invoice = http.expectOne(`${base}/service-reports/r1/invoice`);
    expect(invoice.request.method).toBe('POST');
    expect(invoice.request.body).toEqual({ tax_rate: 22 });
    invoice.flush({ data: { invoice_id: 'i1' } });
  });

  it('covers equipment, history and meters', () => {
    api.listEquipment().subscribe();
    http.expectOne(`${base}/equipment`).flush({ data: [] });

    api.getEquipmentHistory('e1').subscribe();
    http.expectOne(`${base}/equipment/e1/service-history`).flush({ data: {} });

    api.updateMeters('e1', { current_operating_hours: 120 }).subscribe();
    const meters = http.expectOne(`${base}/equipment/e1/meters`);
    expect(meters.request.method).toBe('PATCH');
    expect(meters.request.body).toEqual({ current_operating_hours: 120 });
    meters.flush({ data: {} });
  });

  it('covers maintenance contracts and the preventive engine', () => {
    api.listContracts().subscribe();
    http.expectOne(`${base}/maintenance-contracts`).flush({ data: [] });

    api.updateContract('c1', { title: 'Renamed' }).subscribe();
    const patch = http.expectOne(`${base}/maintenance-contracts/c1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ title: 'Renamed' });
    patch.flush({ data: {} });

    api.runPreventive().subscribe();
    const run = http.expectOne(`${base}/preventive-maintenance/run`);
    expect(run.request.method).toBe('POST');
    expect(run.request.body).toEqual({});
    run.flush({ data: { evaluated_assets: 0, created: [], skipped_existing: 0 } });
  });
});
