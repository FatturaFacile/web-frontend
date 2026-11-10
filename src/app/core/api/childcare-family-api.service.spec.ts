import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ChildcareFamilyApiService } from './childcare-family-api.service';

describe('ChildcareFamilyApiService', () => {
  let service: ChildcareFamilyApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/childcare-family`;
  const familyToken = 'family-' + 'token-fixture';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChildcareFamilyApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChildcareFamilyApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the children of the guardian with the token in the X-Family-Token header only', () => {
    service.getChildren(familyToken).subscribe((res) => {
      expect(res.data[0].reference_code).toBe('C-001');
    });
    const req = httpMock.expectOne(`${base}/children`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-Family-Token')).toBe(familyToken);
    expect(req.request.url).not.toContain(familyToken);
    req.flush({ data: [{ id: 'c1', reference_code: 'C-001', first_name: 'Luca', last_name: 'Rossi' }] });
  });

  it('reads the attendance of a month and the daily report of a day', () => {
    service.getAttendance(familyToken, 'c1', '2026-05').subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const attendance = httpMock.expectOne((r) => r.url === `${base}/children/c1/attendance`);
    expect(attendance.request.params.get('month')).toBe('2026-05');
    expect(attendance.request.headers.get('X-Family-Token')).toBe(familyToken);
    attendance.flush({ data: [{ date: '2026-05-04', status: 'present', absence_reason: null, check_in_at: null, check_out_at: null }] });

    service.getDailyReport(familyToken, 'c1', '2026-05-04').subscribe((res) => {
      expect(res.data.notes[0].category).toBe('meal');
    });
    const report = httpMock.expectOne((r) => r.url === `${base}/children/c1/daily-report`);
    expect(report.request.params.get('date')).toBe('2026-05-04');
    report.flush({
      data: { child_id: 'c1', date: '2026-05-04', status: 'present', check_in_at: null, check_out_at: null, picked_up_by: null, meals: ['lunch'], notes: [{ category: 'meal', body: 'Ate well' }] },
    });
  });

  it('lists the invoices and the documents of the guardian', () => {
    service.getInvoices(familyToken).subscribe((res) => expect(res.data[0].total_gross).toBe('480.00'));
    httpMock
      .expectOne(`${base}/invoices`)
      .flush({ data: [{ id: 'i1', invoice_number: '2026/12', date: '2026-05-01', currency: 'CHF', total_gross: '480.00', payment_status: 'unpaid' }] });

    service.getDocuments(familyToken).subscribe((res) => expect(res.data[0].has_file).toBe(true));
    httpMock
      .expectOne(`${base}/documents`)
      .flush({ data: [{ id: 'd1', child_id: 'c1', title: 'Contract', status: 'to_sign', has_file: true, signed_at: null }] });
  });

  it('downloads a document as a blob and signs it with the typed name', () => {
    service.downloadDocument(familyToken, 'd1').subscribe((blob) => expect(blob.size).toBe(3));
    const download = httpMock.expectOne(`${base}/documents/d1/download`);
    expect(download.request.responseType).toBe('blob');
    expect(download.request.headers.get('X-Family-Token')).toBe(familyToken);
    download.flush(new Blob(['pdf']));

    service.signDocument(familyToken, 'd1', { signed_name: 'Anna Rossi', accept: true }).subscribe((res) => {
      expect(res.data.status).toBe('signed');
    });
    const sign = httpMock.expectOne(`${base}/documents/d1/sign`);
    expect(sign.request.method).toBe('POST');
    expect(sign.request.body).toEqual({ signed_name: 'Anna Rossi', accept: true });
    sign.flush({ data: { id: 'd1', status: 'signed', signed_at: '2026-05-05T09:00:00Z' } });
  });

  it('reads and sends messages', () => {
    service.getMessages(familyToken).subscribe((res) => expect(res.data[0].direction).toBe('to_family'));
    httpMock
      .expectOne(`${base}/messages`)
      .flush({ data: [{ id: 'm1', child_id: 'c1', direction: 'to_family', body: 'Hello', created_at: null }] });

    service.sendMessage(familyToken, { child_id: 'c1', body: 'Luca is ill today' }).subscribe((res) => expect(res.data.id).toBe('m2'));
    const post = httpMock.expectOne(`${base}/messages`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ child_id: 'c1', body: 'Luca is ill today' });
    expect(post.request.headers.get('X-Family-Token')).toBe(familyToken);
    post.flush({ data: { id: 'm2' } });
  });
});
