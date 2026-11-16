import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HANDLED_ERROR_STATUSES } from '../interceptors/error.interceptor';
import { PublicRmaApiService } from './public-rma-api.service';
import { WarrantyRmaApiService } from './warranty-rma-api.service';

describe('WarrantyRmaApiService / PublicRmaApiService', () => {
  const base = 'https://api.fatturafacile.eu/api/v1';
  const originalApiBaseUrl = environment.apiBaseUrl;
  let http: HttpTestingController;
  let api: WarrantyRmaApiService;
  let publicApi: PublicRmaApiService;

  beforeEach(() => {
    environment.apiBaseUrl = base;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(WarrantyRmaApiService);
    publicApi = TestBed.inject(PublicRmaApiService);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('looks up a serial with query params and handles 404/409 itself', () => {
    api.lookupSerial('SN 1', null).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/esm/equipment-passports/lookup`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('serial_number')).toBe('SN 1');
    expect(req.request.params.has('product_id')).toBe(false);
    expect(req.request.context.get(HANDLED_ERROR_STATUSES)).toEqual([404, 409]);
    req.flush({ data: {} });
  });

  it('lists passports dropping empty filters', () => {
    api
      .listPassports({ serial_number: 'SN', customer_id: null, warranty: 'in', page: 2 })
      .subscribe();
    const req = http.expectOne((r) => r.url === `${base}/esm/equipment-passports`);
    expect(req.request.params.keys().sort()).toEqual(['page', 'serial_number', 'warranty']);
    req.flush({ data: [], meta: {} });
  });

  it('creates passports, adds extensions and reads genealogy', () => {
    api
      .createPassport({
        serial_number: 'SN',
        current_owner_customer_id: 'c1',
        delivery_date: '2025-03-10',
      })
      .subscribe();
    const create = http.expectOne(`${base}/esm/equipment-passports`);
    expect(create.request.method).toBe('POST');
    create.flush({ data: {} });

    api.addExtension('p1', { name: 'CP', months: 12, starts_at: '2027-03-10' }).subscribe();
    const ext = http.expectOne(`${base}/esm/equipment-passports/p1/extensions`);
    expect(ext.request.method).toBe('POST');
    ext.flush({ data: {} });

    api.getGenealogy('p1').subscribe();
    http.expectOne(`${base}/esm/equipment-passports/p1/genealogy`).flush({ data: {} });

    api.updatePassport('p1', { installed_firmware_version: '2.0' }).subscribe();
    const put = http.expectOne(`${base}/esm/equipment-passports/p1`);
    expect(put.request.method).toBe('PUT');
    put.flush({ data: {} });
  });

  it('issues an RMA and loads the board with filters', () => {
    api.issueRma({ equipment_passport_id: 'p1', reported_symptom: 'No power' }).subscribe();
    const issue = http.expectOne(`${base}/esm/rma-orders`);
    expect(issue.request.method).toBe('POST');
    expect(issue.request.body).toEqual({
      equipment_passport_id: 'p1',
      reported_symptom: 'No power',
    });
    issue.flush({ data: {} });

    api.getBoard({ warranty_status: 'goodwill', include_closed: 0 }).subscribe();
    const board = http.expectOne((r) => r.url === `${base}/esm/rma-orders/board`);
    expect(board.request.params.get('warranty_status')).toBe('goodwill');
    expect(board.request.params.get('include_closed')).toBe('0');
    board.flush({ data: { columns: [] } });
  });

  it.each([
    ['receive', (a: WarrantyRmaApiService) => a.receive('r1', {})],
    [
      'diagnosis',
      (a: WarrantyRmaApiService) =>
        a.diagnose('r1', { lab_bench_diagnostic_notes: 'x', repair_feasible: true, lines: [] }),
    ],
    ['estimate/approve', (a: WarrantyRmaApiService) => a.approveEstimate('r1')],
    ['estimate/decline', (a: WarrantyRmaApiService) => a.declineEstimate('r1')],
    ['estimate/resend', (a: WarrantyRmaApiService) => a.resendEstimate('r1')],
    ['parts-received', (a: WarrantyRmaApiService) => a.partsReceived('r1')],
    ['complete-repair', (a: WarrantyRmaApiService) => a.completeRepair('r1', {})],
    ['return', (a: WarrantyRmaApiService) => a.returnToCustomer('r1', {})],
    ['close', (a: WarrantyRmaApiService) => a.close('r1')],
    ['cancel', (a: WarrantyRmaApiService) => a.cancel('r1', { reason: 'x' })],
  ])('posts the %s transition and handles 409 itself', (path, call) => {
    call(api).subscribe();
    const req = http.expectOne(`${base}/esm/rma-orders/r1/${path}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.context.get(HANDLED_ERROR_STATUSES)).toEqual([409]);
    req.flush({ data: {} });
  });

  it('reads the label and regenerates the tracking token', () => {
    api.getLabel('r1').subscribe();
    http.expectOne(`${base}/esm/rma-orders/r1/label`).flush({ data: {} });
    api.regenerateTrackingToken('r1').subscribe();
    const req = http.expectOne(`${base}/esm/rma-orders/r1/tracking-token`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: {} });
  });

  it('handles loaners', () => {
    api.listLoaners({ overdue: 1, register_type: 'prestito_uso' }).subscribe();
    const list = http.expectOne((r) => r.url === `${base}/esm/loaners`);
    expect(list.request.params.get('overdue')).toBe('1');
    list.flush({ data: [], meta: {} });

    api
      .issueLoaner('r1', { loaner_serial_number: 'L1', register_type: 'prestito_uso' })
      .subscribe();
    expect(http.expectOne(`${base}/esm/rma-orders/r1/loaners`).request.method).toBe('POST');

    api.returnLoaner('l1').subscribe();
    http.expectOne(`${base}/esm/loaners/l1/return`).flush({ data: {} });
    api.markLoanerLost('l1').subscribe();
    http.expectOne(`${base}/esm/loaners/l1/mark-lost`).flush({ data: {} });
  });

  it('handles vendor claims', () => {
    api.listVendorClaims({ status: 'draft' }).subscribe();
    http
      .expectOne((r) => r.url === `${base}/esm/vendor-claims` && r.params.get('status') === 'draft')
      .flush({ data: [] });

    api.patchVendorClaim('v1', { notes: 'n' }).subscribe();
    const patch = http.expectOne(`${base}/esm/vendor-claims/v1`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ data: {} });

    api.transitionVendorClaim('v1', { to: 'submitted' }).subscribe();
    const transition = http.expectOne(`${base}/esm/vendor-claims/v1/transition`);
    expect(transition.request.body).toEqual({ to: 'submitted' });
    transition.flush({ data: {} });
  });

  it('calls the public estimate and tracking endpoints without auth handling', () => {
    publicApi.getEstimate('tok/en').subscribe();
    const get = http.expectOne(`${base}/public/rma/estimates/tok%2Fen`);
    expect(get.request.method).toBe('GET');
    expect(get.request.headers.has('Authorization')).toBe(false);
    expect(get.request.context.get(HANDLED_ERROR_STATUSES)).toEqual([404, 409]);
    get.flush({ data: {} });

    publicApi.acceptEstimate('tok', { accepted_by_name: 'Mario Rossi' }).subscribe();
    const accept = http.expectOne(`${base}/public/rma/estimates/tok/accept`);
    expect(accept.request.body).toEqual({ accepted_by_name: 'Mario Rossi' });
    accept.flush({ data: {} });

    publicApi.declineEstimate('tok', { declined_by_name: 'Mario Rossi', reason: null }).subscribe();
    http.expectOne(`${base}/public/rma/estimates/tok/decline`).flush({ data: {} });

    publicApi.getTracking('RMA-2026-000123', 'raw').subscribe();
    const tracking = http.expectOne((r) => r.url === `${base}/public/rma/tracking`);
    expect(tracking.request.params.get('rma_number')).toBe('RMA-2026-000123');
    expect(tracking.request.params.get('token')).toBe('raw');
    tracking.flush({ data: {} });
  });
});
