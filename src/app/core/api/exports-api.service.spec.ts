import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ExportsApiService } from '@core';

describe('ExportsApiService', () => {
  let service: ExportsApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/exports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExportsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExportsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('downloads the accountant archive of a period as a blob', () => {
    service.downloadAccountantArchive('2026-01-01', '2026-03-31').subscribe((blob) => expect(blob.size).toBe(3));
    const req = httpMock.expectOne((r) => r.url === `${base}/accountant-archive`);
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-03-31');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['zip']));
  });

  it('downloads a dataset CSV with and without a period', () => {
    service.downloadDatasetCsv('invoices', { from: '2026-01-01', to: null }).subscribe();
    const withPeriod = httpMock.expectOne((r) => r.url === `${base}/csv/invoices`);
    expect(withPeriod.request.params.get('from')).toBe('2026-01-01');
    expect(withPeriod.request.params.has('to')).toBe(false);
    withPeriod.flush(new Blob(['a;b']));

    service.downloadDatasetCsv('contacts').subscribe();
    const plain = httpMock.expectOne(`${base}/csv/contacts`);
    expect(plain.request.params.keys().length).toBe(0);
    expect(plain.request.responseType).toBe('blob');
    plain.flush(new Blob(['a']));
  });

  it('queues an export, reads the history and asks for a signed link', () => {
    service.createJob({ dataset: 'contacts' }).subscribe();
    const create = httpMock.expectOne(`${base}/jobs`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ dataset: 'contacts' });
    create.flush({ success: true, message: '', data: {} });

    service.listJobs({ status: 'failed' }).subscribe();
    const list = httpMock.expectOne((r) => r.url === `${base}/jobs`);
    expect(list.request.params.get('status')).toBe('failed');
    list.flush({ success: true, message: '', data: [] });

    service.getJobLink('j1').subscribe();
    httpMock.expectOne(`${base}/jobs/j1/link`).flush({ success: true, message: '', data: { url: 'u', expires_in_minutes: 60 } });

    service.retryJob('j1').subscribe();
    expect(httpMock.expectOne(`${base}/jobs/j1/retry`).request.method).toBe('POST');
  });

  it('manages the export schedules', () => {
    service.listSchedules().subscribe();
    httpMock.expectOne(`${base}/schedules`).flush({ success: true, message: '', data: [] });

    service.createSchedule({ dataset: 'invoices', frequency: 'monthly', period: 'previous_month' }).subscribe();
    expect(httpMock.expectOne(`${base}/schedules`).request.method).toBe('POST');

    service.updateSchedule('s1', { dataset: 'invoices', frequency: 'daily', period: 'all', is_active: false }).subscribe();
    expect(httpMock.expectOne(`${base}/schedules/s1`).request.method).toBe('PUT');

    service.deleteSchedule('s1').subscribe();
    expect(httpMock.expectOne(`${base}/schedules/s1`).request.method).toBe('DELETE');
  });

  it('previews and imports a file as multipart with the mapping fields', () => {
    const file = new File(['a;b'], 'contacts.csv');
    service.previewImport('contacts', file).subscribe();
    const preview = httpMock.expectOne(`${base}/imports/preview`);
    expect((preview.request.body as FormData).get('dataset')).toBe('contacts');
    preview.flush({ success: true, message: '', data: {} });

    service.importFile('contacts', file, { email: 'Mail' }, true).subscribe();
    const run = httpMock.expectOne(`${base}/imports`);
    const body = run.request.body as FormData;
    expect(body.get('mapping[email]')).toBe('Mail');
    expect(body.get('dry_run')).toBe('1');
    run.flush({ success: true, message: '', data: {} });
  });

  it('reads a single export job', () => {
    service.getJob('j-1').subscribe();
    const req = httpMock.expectOne(`${base}/jobs/j-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { id: 'j-1' } });
  });
});
