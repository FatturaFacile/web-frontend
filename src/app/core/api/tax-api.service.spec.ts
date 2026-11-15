import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { fiscalErrorCode, TaxApiService } from './tax-api.service';

describe('TaxApiService', () => {
  const base = environment.apiBaseUrl;
  let api: TaxApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TaxApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the preview request body as is', () => {
    const body = {
      split_payment: false,
      fund: { type: 'TC22', percent: 4 },
      items: [{ quantity: 1, unit_price: 1000, tax_rate: 22 }],
    };
    let due: string | undefined;
    api.preview(body).subscribe((res) => (due = res.data.totals.due));

    const req = http.expectOne(`${base}/tax/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, message: '', data: { totals: { due: '1068.80' } } });
    expect(due).toBe('1068.80');
  });

  it('queries the quarterly stamp duty report and its CSV', () => {
    api.getStampDutyQuarterly(2026, 2).subscribe();
    api.downloadStampDutyQuarterlyCsv(2026, 2).subscribe();

    const [json, csv] = http.match((r) => r.url === `${base}/tax/stamp-duty/quarterly`);
    expect(json.request.params.get('year')).toBe('2026');
    expect(json.request.params.get('quarter')).toBe('2');
    expect(json.request.params.has('format')).toBe(false);
    expect(csv.request.params.get('format')).toBe('csv');
    expect(csv.request.responseType).toBe('blob');
    json.flush({ data: null });
    csv.flush(new Blob(['a;b'], { type: 'text/csv' }));
  });

  it('queries the CU withholding report and its CSV', () => {
    api.getWithholdingsReport(2025).subscribe();
    api.downloadWithholdingsReportCsv(2025).subscribe();

    const [json, csv] = http.match((r) => r.url === `${base}/tax/withholdings/report`);
    expect(json.request.params.get('year')).toBe('2025');
    expect(csv.request.params.get('format')).toBe('csv');
    expect(csv.request.responseType).toBe('blob');
    json.flush({ data: null });
    csv.flush(new Blob());
  });

  it('queries the ENASARCO status of a principal', () => {
    api.getEnasarcoStatus('c-1', 2026).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/tax/enasarco/status`);
    expect(req.request.params.get('contact_id')).toBe('c-1');
    expect(req.request.params.get('year')).toBe('2026');
    req.flush({ data: null });
  });

  describe('fiscalErrorCode', () => {
    const error = (status: number, body: unknown) => new HttpErrorResponse({ status, error: body });

    it('returns the code of a fiscal 422', () => {
      expect(
        fiscalErrorCode(
          error(422, { code: 'forfettario_incompatible', errors: { withholding: ['x'] } }),
        ),
      ).toBe('forfettario_incompatible');
    });

    it('ignores plain validation errors, unknown codes and other statuses', () => {
      expect(fiscalErrorCode(error(422, { errors: { date: ['x'] } }))).toBeNull();
      expect(fiscalErrorCode(error(422, { code: 'other', errors: {} }))).toBeNull();
      expect(fiscalErrorCode(error(500, { code: 'invalid_natura' }))).toBeNull();
      expect(fiscalErrorCode(new Error('x'))).toBeNull();
    });
  });
});
