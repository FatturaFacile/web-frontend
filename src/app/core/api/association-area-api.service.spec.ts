import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssociationAreaApiService } from './association-area-api.service';

describe('AssociationAreaApiService', () => {
  let service: AssociationAreaApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/association-area`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssociationAreaApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssociationAreaApiService);
    http = TestBed.inject(HttpTestingController);
    service.token.set('area-token');
  });

  afterEach(() => http.verify());

  function expectRequest(method: string, path: string) {
    const req = http.expectOne(`${base}${path}`);
    expect(req.request.method).toBe(method);
    expect(req.request.headers.get('X-Area-Token')).toBe('area-token');
    return req;
  }

  it('reads who is using the area', () => {
    let lastName: string | null = null;
    service.me().subscribe((res) => (lastName = res.data.contact.last_name));
    expectRequest('GET', '/me').flush({ data: { roles: [], contact: { last_name: 'Rossi' }, profile: null, wards: [] } });
    expect(lastName).toBe('Rossi');
  });

  it('updates the own contact data and the one of a minor in care', () => {
    service.updateContact({ email: 'a@example.ch', phone: null }).subscribe();
    const own = expectRequest('PUT', '/me/contact');
    expect(own.request.body).toEqual({ email: 'a@example.ch', phone: null });
    own.flush({ data: { email: 'a@example.ch', phone: null } });

    service.updateWardContact('m-1', { address: { street: 'Via Roma', postal_code: '6900', city: 'Lugano' } }).subscribe();
    const ward = expectRequest('PUT', '/members/m-1/contact');
    expect(ward.request.body.address.city).toBe('Lugano');
    ward.flush({ data: { email: null, phone: null } });
  });

  it('reads the card and downloads it as PDF', () => {
    service.card('m-1').subscribe((res) => expect(res.data.card_number).toBe('T-001'));
    expectRequest('GET', '/members/m-1/card').flush({ data: { card_number: 'T-001', status: 'active' } });

    service.cardPdf('m-1').subscribe((blob) => expect(blob.size).toBe(3));
    const pdf = expectRequest('GET', '/members/m-1/card/pdf');
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['pdf']));
  });

  it('reads the fees and creates the payment link of an instalment', () => {
    service.fees('m-1').subscribe((res) => expect(res.data.standing).toBe('attention'));
    expectRequest('GET', '/members/m-1/fees').flush({ data: { standing: 'attention', color: 'orange', assignments: [] } });

    service.payInstalment('i-1').subscribe((res) => expect(res.data.url).toBe('https://pay.example/1'));
    const pay = expectRequest('POST', '/instalments/i-1/pay');
    expect(pay.request.body).toEqual({});
    pay.flush({ data: { url: 'https://pay.example/1', amount: '50.00', expires_at: null } });
  });

  it('lists the receipts and downloads one as PDF', () => {
    service.receipts('m-1').subscribe((res) => expect(res.data.length).toBe(1));
    expectRequest('GET', '/members/m-1/receipts').flush({ data: [{ id: 'r-1', number: 'REC-1' }] });

    service.receiptPdf('r-1').subscribe();
    const pdf = expectRequest('GET', '/receipts/r-1/pdf');
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['pdf']));
  });

  it('reads the calendar, the shared documents and downloads a document', () => {
    service.calendar('m-1').subscribe((res) => expect(res.data[0].title).toBe('Yoga'));
    expectRequest('GET', '/members/m-1/calendar').flush({ data: [{ course_id: 'c-1', title: 'Yoga', suspended: false }] });

    service.documents('m-1').subscribe((res) => expect(res.data.length).toBe(1));
    expectRequest('GET', '/members/m-1/documents').flush({ data: [{ id: 'd-1' }] });

    service.downloadDocument('m-1', 'd-1').subscribe();
    const file = expectRequest('GET', '/members/m-1/documents/d-1/download');
    expect(file.request.responseType).toBe('blob');
    file.flush(new Blob(['x']));
  });

  it('lists the authorizations of a minor and signs one', () => {
    service.authorizations('m-1').subscribe((res) => expect(res.data.length).toBe(1));
    expectRequest('GET', '/members/m-1/authorizations').flush({ data: [{ id: 'a-1', status: 'pending' }] });

    service.signAuthorization('m-1', 'a-1', 'Anna Rossi').subscribe();
    const sign = expectRequest('POST', '/members/m-1/authorizations/a-1/sign');
    expect(sign.request.body).toEqual({ signed_name: 'Anna Rossi' });
    sign.flush({ data: { id: 'a-1', status: 'signed' } });
  });

  it('serves the instructor: courses, participants and the attendance sheet', () => {
    service.instructorCourses().subscribe((res) => expect(res.data[0].id).toBe('c-1'));
    expectRequest('GET', '/instructor/courses').flush({ data: [{ id: 'c-1', title: 'Yoga', kind: 'recurring' }] });

    service.instructorParticipants('c-1').subscribe((res) => expect(res.data[0].name).toBe('Mario Rossi'));
    expectRequest('GET', '/instructor/courses/c-1/participants').flush({ data: [{ member_id: 'm-1', name: 'Mario Rossi' }] });

    const payload = { date: '2027-05-03', entries: [{ member_id: 'm-1', status: 'present' as const }] };
    service.recordInstructorAttendance('c-1', payload).subscribe();
    const attendance = expectRequest('POST', '/instructor/courses/c-1/attendance');
    expect(attendance.request.body).toEqual(payload);
    attendance.flush({ data: [] });
  });
});
