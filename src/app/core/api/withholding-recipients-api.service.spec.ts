import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { WithholdingRecipientsApiService } from './withholding-recipients-api.service';

describe('WithholdingRecipientsApiService', () => {
  let service: WithholdingRecipientsApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/withholding-recipients`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WithholdingRecipientsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WithholdingRecipientsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads the lookups', () => {
    service.getLookups().subscribe();
    const request = httpTesting.expectOne(`${base}/lookups`);
    expect(request.request.method).toBe('GET');
    request.flush({ data: {} });
  });

  it('sends the dashboard filters, the alert flag as 1 and drops the empty ones', () => {
    service
      .getDashboard({ regime: 'occasional_worker', year: 2026, only_alerts: true, search: '' })
      .subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/dashboard`);
    expect(request.request.params.get('regime')).toBe('occasional_worker');
    expect(request.request.params.get('year')).toBe('2026');
    expect(request.request.params.get('only_alerts')).toBe('1');
    expect(request.request.params.has('search')).toBe(false);
    request.flush({ data: [], meta: {} });

    service.getDashboard().subscribe();
    const plain = httpTesting.expectOne((req) => req.url === `${base}/dashboard`);
    expect(plain.request.params.has('only_alerts')).toBe(false);
    plain.flush({ data: [] });
  });

  it('creates, reads, updates and deletes a recipient and reads its thresholds', () => {
    service.createRecipient({ display_name: 'Anna', regime: 'agent_25bis' }).subscribe();
    const create = httpTesting.expectOne(`${base}/recipients`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ display_name: 'Anna', regime: 'agent_25bis' });
    create.flush({ data: {} });

    service.getRecipient('r-1').subscribe();
    httpTesting.expectOne(`${base}/recipients/r-1`).flush({ data: {} });

    service.updateRecipient('r-1', { notes: 'x' }).subscribe();
    const update = httpTesting.expectOne(`${base}/recipients/r-1`);
    expect(update.request.method).toBe('PUT');
    update.flush({ data: {} });

    service.deleteRecipient('r-1').subscribe();
    const remove = httpTesting.expectOne(`${base}/recipients/r-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ data: null });

    service.getThresholds('r-1', 2026).subscribe();
    const thresholds = httpTesting.expectOne(
      (req) => req.url === `${base}/recipients/r-1/thresholds`,
    );
    expect(thresholds.request.params.get('year')).toBe('2026');
    thresholds.flush({ data: [] });
  });

  it('manages the 20% declarations of an agent', () => {
    service.listCertificates('r-1').subscribe();
    httpTesting.expectOne(`${base}/recipients/r-1/certificates`).flush({ data: [] });

    service
      .createCertificate('r-1', {
        fiscal_year: 2027,
        received_on: '2026-12-20',
        valid_from: '2027-01-01',
        valid_to: '2027-12-31',
        pec_message_id: null,
        pec_archive_reference: null,
        notes: null,
      })
      .subscribe();
    const create = httpTesting.expectOne(`${base}/recipients/r-1/certificates`);
    expect(create.request.method).toBe('POST');
    create.flush({ data: {} });

    service.deleteCertificate('c-1').subscribe();
    const remove = httpTesting.expectOne(`${base}/certificates/c-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ data: null });
  });

  it('runs the INL workflow and downloads the communication as a blob', () => {
    service.listInlNotifications('r-1').subscribe();
    httpTesting.expectOne(`${base}/recipients/r-1/inl-notifications`).flush({ data: [] });

    service
      .createInlNotification('r-1', {
        work_start_date: '2026-05-01',
        work_end_date: '2026-05-03',
        activity_description: 'Talk',
        work_place: null,
        estimated_compensation: 300,
      })
      .subscribe();
    httpTesting.expectOne(`${base}/recipients/r-1/inl-notifications`).flush({ data: {} });

    service.markInlSent('n-1', { protocol_reference: 'P-1' }).subscribe();
    const sent = httpTesting.expectOne(`${base}/inl-notifications/n-1/mark-sent`);
    expect(sent.request.body).toEqual({ protocol_reference: 'P-1' });
    sent.flush({ data: {} });

    service.cancelInl('n-1').subscribe();
    httpTesting.expectOne(`${base}/inl-notifications/n-1/cancel`).flush({ data: {} });

    service.downloadInl('n-1', 'xml').subscribe();
    const download = httpTesting.expectOne(
      (req) => req.url === `${base}/inl-notifications/n-1/download`,
    );
    expect(download.request.params.get('format')).toBe('xml');
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['<xml/>']));
  });

  it('simulates a compensation and lists, posts and batches settlements', () => {
    service
      .simulate({ regime: 'occasional_worker', gross_amount: 100, payment_date: '2026-05-10' })
      .subscribe();
    const simulate = httpTesting.expectOne(`${base}/compensations/simulate`);
    expect(simulate.request.method).toBe('POST');
    simulate.flush({ data: {} });

    service.listSettlements({ tax_year: 2026, accrual_month: '2026-05', page: 2 }).subscribe();
    const list = httpTesting.expectOne((req) => req.url === `${base}/settlements`);
    expect(list.request.params.get('accrual_month')).toBe('2026-05');
    expect(list.request.params.get('page')).toBe('2');
    list.flush({ data: [], meta: {} });

    service.getSettlement('s-1').subscribe();
    httpTesting.expectOne(`${base}/settlements/s-1`).flush({ data: {} });

    const item = { recipient_profile_id: 'r-1', gross_amount: 100, payment_date: '2026-05-10' };
    service.postPayment(item).subscribe();
    httpTesting.expectOne(`${base}/settlements`).flush({ data: {} });

    service.postBatch([item, item]).subscribe();
    const batch = httpTesting.expectOne(`${base}/settlements/batch`);
    expect((batch.request.body as { items: unknown[] }).items).toHaveLength(2);
    batch.flush({ data: [] });
  });

  it('reads the F24 preview and downloads the F24 and UniEmens files', () => {
    service.getF24('2026-05').subscribe();
    const preview = httpTesting.expectOne((req) => req.url === `${base}/flows/f24`);
    expect(preview.request.params.get('accrual_month')).toBe('2026-05');
    preview.flush({ data: {} });

    service.exportF24('2026-05').subscribe();
    const csv = httpTesting.expectOne((req) => req.url === `${base}/flows/f24/export`);
    expect(csv.request.responseType).toBe('blob');
    csv.flush(new Blob(['a;b']));

    service.exportUniEmens('2026-05').subscribe();
    const xml = httpTesting.expectOne((req) => req.url === `${base}/flows/uniemens`);
    expect(xml.request.responseType).toBe('blob');
    xml.flush(new Blob(['<x/>']));
  });

  it('lists, generates and exports the annual returns', () => {
    service.listAnnualReturns(2026).subscribe();
    const list = httpTesting.expectOne((req) => req.url === `${base}/annual-returns`);
    expect(list.request.params.get('tax_year')).toBe('2026');
    list.flush({ data: [] });

    service.generateAnnualReturns(2026).subscribe();
    const all = httpTesting.expectOne(`${base}/annual-returns/generate`);
    expect(all.request.body).toEqual({ tax_year: 2026 });
    all.flush({ data: [] });

    service.generateAnnualReturns(2026, 'r-1').subscribe();
    const one = httpTesting.expectOne(`${base}/annual-returns/generate`);
    expect(one.request.body).toEqual({ tax_year: 2026, recipient_profile_id: 'r-1' });
    one.flush({ data: [] });

    service.exportAnnualReturns(2026).subscribe();
    const csv = httpTesting.expectOne((req) => req.url === `${base}/annual-returns/export`);
    expect(csv.request.responseType).toBe('blob');
    csv.flush(new Blob(['a']));
  });
});
