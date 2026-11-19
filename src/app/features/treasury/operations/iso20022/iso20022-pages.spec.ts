import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { InboxOutline } from '@ant-design/icons-angular/icons';
import { BankingApiService } from '@core/api/banking-api.service';
import { InvoiceApiService } from '@core/api/invoice-api.service';
import { ProcurementApiService } from '@core/api/procurement-api.service';
import { Iso20022ImportSummary, ReconciliationTransaction } from '@core/models/iso20022.model';
import { TrIso20022ImportComponent } from './tr-iso20022-import.component';
import { TrPaymentRunComponent } from './tr-payment-run.component';
import { TrReconciliationWorkbenchComponent } from './tr-reconciliation-workbench.component';

const summary: Iso20022ImportSummary = {
  statement_id: 's-1',
  format: 'camt054',
  account_iban: 'CH4431999123000889012',
  currency: 'CHF',
  statement_date: '2026-03-14',
  opening_balance: null,
  closing_balance: null,
  entries: 3,
  stored: 2,
  duplicates: 1,
  reconciled: 1,
  unmatched: 1,
  auto_reconciled: true,
  status: 'partially_reconciled',
};

const transaction = (over: Partial<ReconciliationTransaction> = {}): ReconciliationTransaction => ({
  id: 't-1',
  bank_statement_id: 's-1',
  booking_date: '2026-03-14',
  value_date: '2026-03-14',
  direction: 'credit',
  amount: 650,
  fee_amount: 0,
  gross_amount: 650,
  currency: 'CHF',
  reference: 'BANK-1',
  qr_reference: '210000000003139471430009017',
  description: 'Overpayment',
  counterpart_name: 'Café Müller AG',
  counterpart_iban: null,
  reconciled: false,
  matched_document_id: null,
  reconciliation_type: null,
  ...over,
});

async function configure(providers: unknown[]): Promise<void> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideRouter([]), provideNzIcons([InboxOutline]), ...(providers as never[])],
  }).compileComponents();
}

describe('TrIso20022ImportComponent', () => {
  it('imports an XML file and shows the auto-reconciliation summary', async () => {
    const importIso20022 = vi.fn().mockReturnValue(of({ success: true, data: summary }));
    await configure([{ provide: BankingApiService, useValue: { importIso20022 } }]);
    const fixture = TestBed.createComponent(TrIso20022ImportComponent);
    fixture.detectChanges();

    const file = new File(['<Document/>'], 'camt054.xml', { type: 'text/xml' });
    fixture.componentInstance.handle(file);
    fixture.detectChanges();

    expect(importIso20022).toHaveBeenCalledWith(file, true);
    const text = fixture.nativeElement.querySelector('[data-testid="import-summary"]').textContent as string;
    expect(text).toContain('camt.054');
    expect(text).toContain('CH4431999123000889012');
  });

  it('rejects files that are not XML without calling the API', async () => {
    const importIso20022 = vi.fn();
    await configure([{ provide: BankingApiService, useValue: { importIso20022 } }]);
    const fixture = TestBed.createComponent(TrIso20022ImportComponent);
    fixture.detectChanges();

    fixture.componentInstance.handle(new File(['x'], 'statement.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(importIso20022).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="import-error"]')).not.toBeNull();
  });

  it('reports an import failure', async () => {
    await configure([{ provide: BankingApiService, useValue: { importIso20022: () => throwError(() => ({ status: 422 })) } }]);
    const fixture = TestBed.createComponent(TrIso20022ImportComponent);
    fixture.detectChanges();

    fixture.componentInstance.handle(new File(['x'], 'bad.xml', { type: 'text/xml' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="import-error"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="import-summary"]')).toBeNull();
  });
});

describe('TrReconciliationWorkbenchComponent', () => {
  it('lists the unmatched transactions and links one to an invoice', async () => {
    const getReconciliationTransactions = vi.fn().mockReturnValue(of({ success: true, data: [transaction()], meta: { total: 1 } }));
    const matchTransaction = vi.fn().mockReturnValue(of({ success: true, data: transaction({ reconciled: true }) }));
    const list = vi.fn().mockReturnValue(of({ data: [{ id: 'inv-1', invoice_number: 'INV-1', total: 500, currency: 'CHF', contact: { company_name: 'Café Müller AG' } }] }));
    await configure([
      { provide: BankingApiService, useValue: { getReconciliationTransactions, matchTransaction } },
      { provide: InvoiceApiService, useValue: { list } },
      { provide: ProcurementApiService, useValue: { getSupplierInvoices: vi.fn() } },
    ]);
    const fixture = TestBed.createComponent(TrReconciliationWorkbenchComponent);
    fixture.detectChanges();

    expect(getReconciliationTransactions).toHaveBeenCalledWith(expect.objectContaining({ status: 'unmatched', page: 1 }));
    expect(fixture.nativeElement.querySelectorAll('[data-testid="transaction-row"]').length).toBe(1);

    const component = fixture.componentInstance as unknown as {
      openMatch(row: ReconciliationTransaction): void;
      selectedInvoice: { set(value: string): void };
      difference: { set(value: string): void };
      confirmMatch(): void;
    };
    component.openMatch(transaction());
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ payment_status: 'unpaid' }));

    component.selectedInvoice.set('inv-1');
    component.difference.set('write_off');
    component.confirmMatch();

    expect(matchTransaction).toHaveBeenCalledWith('t-1', { invoice_id: 'inv-1', difference_handling: 'write_off' });
    expect(getReconciliationTransactions).toHaveBeenCalledTimes(2);
  });

  it('offers supplier invoices for a debit', async () => {
    const getSupplierInvoices = vi.fn().mockReturnValue(of({ data: [] }));
    await configure([
      { provide: BankingApiService, useValue: { getReconciliationTransactions: () => of({ success: true, data: [], meta: { total: 0 } }) } },
      { provide: InvoiceApiService, useValue: { list: vi.fn() } },
      { provide: ProcurementApiService, useValue: { getSupplierInvoices } },
    ]);
    const fixture = TestBed.createComponent(TrReconciliationWorkbenchComponent);
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { openMatch(row: ReconciliationTransaction): void }).openMatch(transaction({ direction: 'debit' }));

    expect(getSupplierInvoices).toHaveBeenCalledWith(expect.objectContaining({ payment_status: 'unpaid' }));
  });
});

describe('TrPaymentRunComponent', () => {
  const invoices = [
    { id: 'a', invoice_number: 'SUP-1', supplier_name: 'Robert Schneider AG', date: '2026-03-01', due_date: '2026-03-31', currency: 'CHF', total_amount: '1949.75', total_paid: '0', approval_status: 'approved' },
    { id: 'b', invoice_number: 'SUP-2', supplier_name: 'Rossi SRL', date: '2026-03-02', currency: 'CHF', total_amount: '250.00', total_paid: '50.00', approval_status: null },
    { id: 'c', invoice_number: 'SUP-3', supplier_name: 'Blocked AG', date: '2026-03-03', currency: 'CHF', total_amount: '10.00', approval_status: 'pending' },
    { id: 'd', invoice_number: 'SUP-4', supplier_name: 'Euro GmbH', date: '2026-03-04', currency: 'EUR', total_amount: '99.00', approval_status: 'approved' },
  ];

  afterEach(() => vi.restoreAllMocks());

  async function setup(exportPain001 = vi.fn()) {
    await configure([
      { provide: ProcurementApiService, useValue: { getSupplierInvoices: () => of({ data: invoices }) } },
      { provide: BankingApiService, useValue: { exportPain001 } },
    ]);
    const fixture = TestBed.createComponent(TrPaymentRunComponent);
    fixture.detectChanges();
    return fixture;
  }

  interface Run {
    toggle(id: string, checked: boolean): void;
    generate(): void;
    version: { set(v: string): void };
    scheme: { set(v: string): void };
  }

  it('lists only invoices that can be paid and totals the open amounts of the selection', async () => {
    const fixture = await setup();
    const run = fixture.componentInstance as unknown as Run;

    expect(fixture.nativeElement.querySelectorAll('[data-testid="run-row"]').length).toBe(3); // the pending invoice is held back

    run.toggle('a', true);
    run.toggle('b', true);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('[data-testid="selection-total"]').textContent as string)).toContain('2');
    expect(fixture.nativeElement.querySelector('[data-testid="mixed-currencies"]')).toBeNull();
  });

  it('blocks a selection that mixes currencies', async () => {
    const exportPain001 = vi.fn();
    const fixture = await setup(exportPain001);
    const run = fixture.componentInstance as unknown as Run;

    run.toggle('a', true);
    run.toggle('d', true);
    fixture.detectChanges();
    run.generate();

    expect(fixture.nativeElement.querySelector('[data-testid="mixed-currencies"]')).not.toBeNull();
    expect(exportPain001).not.toHaveBeenCalled();
  });

  it('requests the chosen version and scheme and downloads the validated XML', async () => {
    const result = { batch_id: 'b-1', message_id: 'MSG-1', format: 'iso_pain_001_ch', pain_version: '03', status: 'exported', xml_preview: '<Document/>', schema_valid: true, filename: 'pain.001.001.03-MSG-1.xml' };
    const exportPain001 = vi.fn().mockReturnValue(of({ success: true, data: result }));
    const fixture = await setup(exportPain001);
    const run = fixture.componentInstance as unknown as Run;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue();

    run.toggle('a', true);
    run.version.set('03');
    run.scheme.set('ch');
    run.generate();
    fixture.detectChanges();

    expect(exportPain001).toHaveBeenCalledWith({ invoice_ids: ['a'], version: '03', scheme: 'ch', execution_date: null });
    expect(click).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="run-result"]').textContent).toContain('pain.001.001.03-MSG-1.xml');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="run-row"]').length).toBe(2);
  });

  it('shows the validation message of a refused export', async () => {
    const exportPain001 = vi.fn().mockReturnValue(throwError(() => ({ error: { errors: { invoice_ids: ['The payment reference is missing'] } } })));
    const fixture = await setup(exportPain001);
    const run = fixture.componentInstance as unknown as Run;

    run.toggle('a', true);
    run.generate();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="run-error"]').textContent).toContain('The payment reference is missing');
  });
});
