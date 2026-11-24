import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ItalianPayrollApiService } from '@core';

const one = { success: true, message: '', data: {} };

describe('ItalianPayrollApiService', () => {
  let service: ItalianPayrollApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/italian-payroll`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ItalianPayrollApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ItalianPayrollApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the own payslips and opens a document as a blob without biometrics', () => {
    service.getMyPayslips().subscribe();
    const list = httpMock.expectOne(`${base}/my-payslips`);
    expect(list.request.method).toBe('GET');
    list.flush({ data: [] });

    service.openMyPayslip('d1', 'cu').subscribe();
    const open = httpMock.expectOne(`${base}/my-payslips/d1/open`);
    expect(open.request.method).toBe('POST');
    expect(open.request.responseType).toBe('blob');
    expect(open.request.body).toEqual({ document_kind: 'cu', biometric_confirmed: false });
    open.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
  });

  it('opens a period and validates its attendance with the fringe benefits', () => {
    service.createPeriod({ year: 2027, month: 3 }).subscribe();
    const create = httpMock.expectOne(`${base}/periods`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ year: 2027, month: 3 });
    create.flush(one);

    service.validateAttendance('p1', [{ employee_id: 'e1', amount: 120 }]).subscribe();
    const validate = httpMock.expectOne(`${base}/periods/p1/validate`);
    expect(validate.request.body).toEqual({
      fringe_benefits: [{ employee_id: 'e1', amount: 120 }],
    });
    validate.flush(one);
  });

  it('downloads the export and the SEPA file as blobs', () => {
    service.exportAttendance('p1', 'zucchetti', 'ACME').subscribe();
    const exported = httpMock.expectOne(`${base}/periods/p1/export`);
    expect(exported.request.responseType).toBe('blob');
    expect(exported.request.body).toEqual({ consultant_format: 'zucchetti', company_code: 'ACME' });
    exported.flush(new Blob(['x']));

    const payload = {
      debtor_name: 'Acme Srl',
      debtor_iban: 'IT60X0542811101000000123456',
      execution_date: '2027-03-27',
    };
    service.generateSepa('p1', payload).subscribe();
    const sepa = httpMock.expectOne(`${base}/periods/p1/sepa`);
    expect(sepa.request.responseType).toBe('blob');
    expect(sepa.request.body).toEqual(payload);
    sepa.flush(new Blob(['<xml/>']));
  });

  it('uploads the payslip bundle as multipart and reports progress events', () => {
    const events: HttpEventType[] = [];
    const file = new File(['%PDF'], 'cedolini.pdf', { type: 'application/pdf' });

    service.importCedolini('p1', file).subscribe((event) => events.push(event.type));
    const request = httpMock.expectOne(`${base}/periods/p1/cedolini`);
    expect(request.request.reportProgress).toBe(true);
    expect((request.request.body as FormData).get('bundle_pdf')).toBeInstanceOf(File);

    request.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
    request.flush(one);
    expect(events).toContain(HttpEventType.UploadProgress);
    expect(events).toContain(HttpEventType.Response);
  });

  it('posts the accounting summary and maps a 422 that does not reconcile', () => {
    const statuses: number[] = [];
    const summary = {
      total_gross_wages: 5000,
      inps_employee_withholding: 459.5,
      inps_employer_contribution: 1500,
      irpef_withholding: 700,
      regional_municipal_addizionali: 60,
      tfr_monthly_accrual: 370.37,
      tfr_fondo_tesoreria_or_previdenza: 370.37,
      net_payable: 3780.5,
    };

    service.importAccounting('p1', summary).subscribe({ error: (e) => statuses.push(e.status) });
    const request = httpMock.expectOne(`${base}/periods/p1/accounting-import`);
    expect(request.request.body).toEqual(summary);
    request.flush({ message: 'non quadra' }, { status: 422, statusText: 'Unprocessable' });
    expect(statuses).toEqual([422]);
  });

  it('reads the F24, the download audit and the TFR ledger with their query parameters', () => {
    service.getF24('p1').subscribe();
    httpMock.expectOne(`${base}/periods/p1/f24`).flush(one);

    service.getDownloadAudit('p1', 'e1').subscribe();
    const audit = httpMock.expectOne((r) => r.url === `${base}/periods/p1/download-audit`);
    expect(audit.request.params.get('employee_id')).toBe('e1');
    audit.flush(one);

    service.getTfrLedger(2027, 2).subscribe();
    const ledger = httpMock.expectOne((r) => r.url === `${base}/tfr-ledger`);
    expect(ledger.request.params.get('year')).toBe('2027');
    expect(ledger.request.params.get('foi_percent')).toBe('2');
    ledger.flush(one);
  });

  it('marks a period paid and saves the GL accounts and causal mappings', () => {
    service.markPaid('p1').subscribe();
    const paid = httpMock.expectOne(`${base}/periods/p1/mark-paid`);
    expect(paid.request.method).toBe('POST');
    paid.flush(one);

    service.saveGlAccounts([{ role: 'gross_wages', account_id: 'a1' }]).subscribe();
    const accounts = httpMock.expectOne(`${base}/gl-accounts`);
    expect(accounts.request.method).toBe('PUT');
    expect(accounts.request.body).toEqual({
      accounts: [{ role: 'gross_wages', account_id: 'a1' }],
    });
    accounts.flush(one);

    service.saveCausalMappings('inaz', [{ causal_code: 'FER', external_code: 'F' }]).subscribe();
    const mappings = httpMock.expectOne(`${base}/causal-mappings`);
    expect(mappings.request.body).toEqual({
      consultant_format: 'inaz',
      mappings: [{ causal_code: 'FER', external_code: 'F' }],
    });
    mappings.flush(one);
  });
});
