import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { DocumentsExtraApiService } from './documents-extra-api.service';
import { GeneralLedgerExtraApiService } from './general-ledger-extra-api.service';
import { InvoicingExtraApiService } from './invoicing-extra-api.service';
import { ProjectExtraApiService } from './project-extra-api.service';
import { PurchasesExtraApiService } from './purchases-extra-api.service';
import { ReturnsApiService } from './returns-api.service';
import { SupplierPortalExtraApiService } from './supplier-portal-extra-api.service';
import { SystemApiService } from './system-api.service';
import { TreasuryExtraApiService } from './treasury-extra-api.service';

describe('Finance extra API services', () => {
  let http: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('documents: downloads the PDF and sends the e-mail by document type', () => {
    const service = TestBed.inject(DocumentsExtraApiService);

    service.downloadPdf('quote', 'q-1', true).subscribe();
    const pdf = http.expectOne((r) => r.url === `${base}/documents/quote/q-1/pdf`);
    expect(pdf.request.method).toBe('GET');
    expect(pdf.request.params.get('inline')).toBe('true');
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob());

    service.sendByEmail('delivery_note', 'd-1', { to: 'a@b.it' }).subscribe();
    const mail = http.expectOne(`${base}/documents/delivery_note/d-1/email`);
    expect(mail.request.method).toBe('POST');
    expect(mail.request.body).toEqual({ to: 'a@b.it' });
    mail.flush({ success: true });

    service.getEmails('invoice', 'i-1').subscribe();
    http.expectOne(`${base}/documents/invoice/i-1/emails`).flush({ success: true, data: [] });
  });

  it('invoicing: lists, reads and creates invoices', () => {
    const service = TestBed.inject(InvoicingExtraApiService);

    service.getInvoices({ status: 'draft' }).subscribe();
    const list = http.expectOne((r) => r.url === `${base}/invoicing/invoices` && r.params.get('status') === 'draft');
    expect(list.request.method).toBe('GET');
    list.flush({ success: true, data: [] });

    service.getInvoice('i-1').subscribe();
    http.expectOne(`${base}/invoicing/invoices/i-1`).flush({ success: true, data: {} });
  });

  it('purchases: orders, receipts, passive invoices, cost rules and payment file', () => {
    const service = TestBed.inject(PurchasesExtraApiService);

    service.getOrders({ status: 'draft' }).subscribe();
    http
      .expectOne((r) => r.url === `${base}/purchases/orders` && r.params.get('status') === 'draft')
      .flush({ success: true, data: [] });

    service.confirmOrder('o-1').subscribe();
    const confirm = http.expectOne(`${base}/purchases/orders/o-1/confirm`);
    expect(confirm.request.method).toBe('POST');
    confirm.flush({ success: true, data: {} });

    service.updateOrder('o-1', { notes: 'x' }).subscribe();
    const update = http.expectOne(`${base}/purchases/orders/o-1`);
    expect(update.request.method).toBe('PUT');
    update.flush({ success: true, data: {} });

    service.getGoodsReceipt('g-1').subscribe();
    http.expectOne(`${base}/purchases/goods-receipts/g-1`).flush({ success: true, data: {} });

    service.getPassiveInvoices().subscribe();
    http.expectOne(`${base}/purchases/passive-invoices`).flush({ success: true, data: [] });

    service.getSupplierInvoiceLines('s-1').subscribe();
    http.expectOne(`${base}/purchases/supplier-invoices/s-1/lines`).flush({ success: true, data: [] });

    service.overrideCostAccount('s-1', { cost_account_id: 'c-1' }).subscribe();
    const account = http.expectOne(`${base}/purchases/supplier-invoices/s-1/cost-account`);
    expect(account.request.method).toBe('PUT');
    account.flush({ success: true });

    service
      .selfInvoice('p-1', { document_type: 'TD17', date: '2026-01-01', tax_rate: 22 })
      .subscribe();
    const self = http.expectOne(`${base}/purchases/passive-invoices/p-1/self-invoice`);
    expect(self.request.method).toBe('POST');
    self.flush({ success: true });

    service.deleteCostRule('r-1').subscribe();
    const del = http.expectOne(`${base}/purchases/cost-rules/r-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ success: true });

    service.exportPain001({ invoice_ids: ['s-1'], format: 'sepa_pain_001_it' }).subscribe();
    const pain = http.expectOne(`${base}/purchases/export-pain001`);
    expect(pain.request.body.format).toBe('sepa_pain_001_it');
    pain.flush({ success: true, data: {} });
  });

  it('general ledger: creates and reads fiscal periods, reads a tax settlement', () => {
    const service = TestBed.inject(GeneralLedgerExtraApiService);

    service
      .createFiscalPeriod({
        fiscal_year_id: 'fy-1',
        period_number: 1,
        period_name: 'Gennaio',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      })
      .subscribe();
    const create = http.expectOne(`${base}/general-ledger/fiscal-periods`);
    expect(create.request.method).toBe('POST');
    create.flush({ success: true, data: {} });

    service.getFiscalPeriod('fp-1').subscribe();
    http.expectOne(`${base}/general-ledger/fiscal-periods/fp-1`).flush({ success: true, data: {} });

    service.getTaxSettlement('ts-1').subscribe();
    http.expectOne(`${base}/general-ledger/tax-settlements/ts-1`).flush({ success: true, data: {} });
  });

  it('treasury: reads a PagoPA notice and a forecast, executes a batch', () => {
    const service = TestBed.inject(TreasuryExtraApiService);

    service.getPagoPaNotice('n-1').subscribe();
    http.expectOne(`${base}/treasury/pagopa-notices/n-1`).flush({ success: true, data: {} });

    service.getCashForecast('f-1').subscribe();
    http.expectOne(`${base}/treasury/cash-forecasts/f-1`).flush({ success: true, data: {} });

    service.executePaymentBatch('b-1').subscribe((res) => expect(res.status).toBe('exported'));
    const exec = http.expectOne(`${base}/treasury/payment-batches/b-1/execute`);
    expect(exec.request.method).toBe('POST');
    expect(exec.request.body).toEqual({ protocol: 'sepa_pain001' });
    exec.flush({ message: 'ok', execution_id: 'e-1', status: 'exported' });
  });

  it('supplier portal: requirements, internal document, assessment, checks, bank change', () => {
    const service = TestBed.inject(SupplierPortalExtraApiService);

    service.createDocumentRequirement({ code: 'DURC', name: 'DURC' }).subscribe();
    const create = http.expectOne(`${base}/supplier-portal/document-requirements`);
    expect(create.request.method).toBe('POST');
    create.flush({ success: true, data: {} });

    service.updateDocumentRequirement('r-1', { is_active: false }).subscribe();
    const update = http.expectOne(`${base}/supplier-portal/document-requirements/r-1`);
    expect(update.request.method).toBe('PUT');
    update.flush({ success: true, data: {} });

    service.submitDocument({ supplier_id: 's-1', requirement_id: 'r-1', notes: 'n' }).subscribe();
    const doc = http.expectOne(`${base}/supplier-portal/documents`);
    expect(doc.request.body instanceof FormData).toBe(true);
    expect((doc.request.body as FormData).get('supplier_id')).toBe('s-1');
    doc.flush({ success: true, data: {} });

    service.getAssessment('a-1').subscribe();
    http.expectOne(`${base}/supplier-portal/qualification-assessments/a-1`).flush({ success: true, data: {} });

    service.getChecks({ result: 'failed' }).subscribe();
    http
      .expectOne((r) => r.url === `${base}/supplier-portal/checks` && r.params.get('result') === 'failed')
      .flush({ success: true, data: [] });

    service.getBankChange('bc-1').subscribe();
    http.expectOne(`${base}/supplier-portal/bank-changes/bc-1`).flush({ success: true, data: {} });
  });

  it('projects: updates and deletes a timesheet entry', () => {
    const service = TestBed.inject(ProjectExtraApiService);

    service.updateTimesheet('t-1', { hours_worked: 4 }).subscribe();
    const update = http.expectOne(`${base}/projects/timesheets/t-1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ hours_worked: 4 });
    update.flush({ success: true, data: {} });

    service.deleteTimesheet('t-1').subscribe();
    const del = http.expectOne(`${base}/projects/timesheets/t-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ success: true });
  });

  it('returns: reads a single warranty, claim and supplier return', () => {
    const service = TestBed.inject(ReturnsApiService);

    service.getWarranty('w-1').subscribe();
    http.expectOne(`${base}/returns/warranties/w-1`).flush({ data: {} });
    service.getClaim('c-1').subscribe();
    http.expectOne(`${base}/returns/claims/c-1`).flush({ data: {} });
    service.getSupplierReturn('sr-1').subscribe();
    http.expectOne(`${base}/returns/supplier-returns/sr-1`).flush({ data: {} });
  });

  it('system: reads the backup status', () => {
    const service = TestBed.inject(SystemApiService);

    service.getBackupStatus().subscribe((res) => expect(res.data.state).toBe('ok'));
    http.expectOne(`${base}/system/backups/status`).flush({ success: true, data: { state: 'ok' } });
  });
});
