import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ReceivablesApiService } from './receivables-api.service';

describe('ReceivablesApiService', () => {
  let service: ReceivablesApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/invoicing/receivables`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReceivablesApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReceivablesApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads the dashboard in a currency and drops an empty currency', () => {
    service.getDashboard('CHF').subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/dashboard`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('currency')).toBe('CHF');
    request.flush({ data: {} });

    service.getDashboard().subscribe();
    const plain = httpTesting.expectOne((req) => req.url === `${base}/dashboard`);
    expect(plain.request.params.has('currency')).toBe(false);
    plain.flush({ data: {} });
  });

  it('asks the aging of one customer', () => {
    service.getAging('c-1', 'EUR').subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/aging`);
    expect(request.request.params.get('customer_id')).toBe('c-1');
    expect(request.request.params.get('currency')).toBe('EUR');
    request.flush({ data: {} });
  });

  it('reads the DSO and the provision', () => {
    service.getDso('c-1', 60, 'EUR').subscribe();
    const dso = httpTesting.expectOne((req) => req.url === `${base}/dso`);
    expect(dso.request.params.get('period_days')).toBe('60');
    dso.flush({ data: {} });

    service.getProvision('c-1').subscribe();
    const provision = httpTesting.expectOne((req) => req.url === `${base}/provision`);
    expect(provision.request.params.get('customer_id')).toBe('c-1');
    provision.flush({ data: {} });
  });

  it('saves the provision rates by bucket key', () => {
    service.saveProvisionRates({ '1_30': 1, '121_plus': 50 }).subscribe();
    const request = httpTesting.expectOne(`${base}/provision/rates`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ rates: { '1_30': 1, '121_plus': 50 } });
    request.flush({ data: {} });
  });

  it('books the provision to the ledger, in a currency when given', () => {
    service.postProvision('CHF').subscribe();
    const request = httpTesting.expectOne(`${base}/provision/post`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ currency: 'CHF' });
    request.flush({ data: {} });

    service.postProvision().subscribe();
    const plain = httpTesting.expectOne(`${base}/provision/post`);
    expect(plain.request.body).toEqual({});
    plain.flush({ data: {} });
  });

  it('drills the open items down by bucket and customer, sending booleans as 1 and 0', () => {
    service
      .listItems({ bucket: '31_60', customer_id: 'c-1', open_only: true, page: 2, per_page: 25 })
      .subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/items`);
    expect(request.request.params.get('bucket')).toBe('31_60');
    expect(request.request.params.get('customer_id')).toBe('c-1');
    expect(request.request.params.get('open_only')).toBe('1');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ data: [], meta: {} });

    service.listItems({ open_only: false, status: 'overdue' }).subscribe();
    const closed = httpTesting.expectOne((req) => req.url === `${base}/items`);
    expect(closed.request.params.get('open_only')).toBe('0');
    expect(closed.request.params.get('status')).toBe('overdue');
    closed.flush({ data: [], meta: {} });

    service.listItems({}).subscribe();
    const bare = httpTesting.expectOne((req) => req.url === `${base}/items`);
    expect(bare.request.params.has('open_only')).toBe(false);
    bare.flush({ data: [], meta: {} });
  });

  it('reads an item and sets or clears its dispute', () => {
    service.getItem('i-1').subscribe();
    httpTesting.expectOne(`${base}/items/i-1`).flush({ data: {} });

    service.setDispute('i-1', { disputed: true, reason: 'wrong price' }).subscribe();
    const dispute = httpTesting.expectOne(`${base}/items/i-1/dispute`);
    expect(dispute.request.method).toBe('POST');
    expect(dispute.request.body).toEqual({ disputed: true, reason: 'wrong price' });
    dispute.flush({ data: {} });
  });

  it('allocates and reverses', () => {
    const payload = {
      allocations: [
        {
          receivable_item_id: 'i-1',
          type: 'payment' as const,
          amount: '100.00',
          value_date: '2026-03-02',
          source_id: 'l-1',
        },
      ],
    };
    service.allocate(payload).subscribe();
    const allocate = httpTesting.expectOne(`${base}/allocations`);
    expect(allocate.request.method).toBe('POST');
    expect(allocate.request.body).toEqual(payload);
    allocate.flush({ data: { allocations: [], items: [] } });

    service.reverseAllocation('a-1').subscribe();
    const reverse = httpTesting.expectOne(`${base}/allocations/a-1/reverse`);
    expect(reverse.request.method).toBe('POST');
    reverse.flush({ data: {} });
  });

  it('loads the ledger with filters and the unreconciled payments', () => {
    service.getLedger('c-1', { from: '2026-01-01', to: '2026-03-31', status: 'open' }).subscribe();
    const ledger = httpTesting.expectOne((req) => req.url === `${base}/customers/c-1/ledger`);
    expect(ledger.request.params.get('from')).toBe('2026-01-01');
    expect(ledger.request.params.get('status')).toBe('open');
    ledger.flush({ data: { movements: [], closing_balance: '0.00' } });

    service.getUnreconciledPayments('c-1').subscribe();
    httpTesting.expectOne(`${base}/customers/c-1/unreconciled-payments`).flush({ data: [] });
  });

  it('reads the credit position, the risk and the limit history', () => {
    service.getCredit('c-1').subscribe();
    httpTesting.expectOne(`${base}/customers/c-1/credit`).flush({ data: {} });
    service.getRisk('c-1').subscribe();
    httpTesting.expectOne(`${base}/customers/c-1/risk`).flush({ data: {} });
    service.getCreditLimits('c-1').subscribe();
    httpTesting.expectOne(`${base}/customers/c-1/credit-limits`).flush({ data: [] });
  });

  it('creates, updates and deletes a credit limit', () => {
    const payload = {
      customer_id: 'c-1',
      currency: 'EUR',
      granted_limit: '5000.00',
      reaction_policy: 'block_order' as const,
      valid_from: '2026-01-01',
    };
    service.createCreditLimit(payload).subscribe();
    const created = httpTesting.expectOne(`${base}/credit-limits`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);
    created.flush({ data: {} });

    service.updateCreditLimit('l-1', { granted_limit: '6000.00' }).subscribe();
    const updated = httpTesting.expectOne(`${base}/credit-limits/l-1`);
    expect(updated.request.method).toBe('PUT');
    expect(updated.request.body).toEqual({ granted_limit: '6000.00' });
    updated.flush({ data: {} });

    service.deleteCreditLimit('l-1').subscribe();
    const deleted = httpTesting.expectOne(`${base}/credit-limits/l-1`);
    expect(deleted.request.method).toBe('DELETE');
    deleted.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('grants and revokes an override', () => {
    service.grantOverride('c-1', { scope: 'order', reason: 'Key account' }).subscribe();
    const grant = httpTesting.expectOne(`${base}/customers/c-1/overrides`);
    expect(grant.request.body).toEqual({ scope: 'order', reason: 'Key account' });
    grant.flush({ data: {} });

    service.revokeOverride('o-1', 'Paid in full').subscribe();
    const revoke = httpTesting.expectOne(`${base}/overrides/o-1/revoke`);
    expect(revoke.request.body).toEqual({ reason: 'Paid in full' });
    revoke.flush({ data: {} });

    service.revokeOverride('o-2').subscribe();
    const bare = httpTesting.expectOne(`${base}/overrides/o-2/revoke`);
    expect(bare.request.body).toEqual({});
    bare.flush({ data: {} });
  });

  it('checks the credit of an operation', () => {
    service.checkCredit({ customer_id: 'c-1', scope: 'delivery_note', amount: '10.00' }).subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/credit-check`);
    expect(request.request.params.get('scope')).toBe('delivery_note');
    expect(request.request.params.get('amount')).toBe('10.00');
    request.flush({ data: {} });
  });

  it('loads the statement and downloads it as pdf and xlsx blobs', () => {
    const period = { from: '2026-01-01', to: '2026-03-31', currency: 'EUR' };
    service.getStatement('c-1', period).subscribe();
    const statement = httpTesting.expectOne(
      (req) => req.url === `${base}/customers/c-1/statement`,
    );
    expect(statement.request.params.get('from')).toBe('2026-01-01');
    expect(statement.request.params.get('currency')).toBe('EUR');
    statement.flush({ data: {} });

    service.downloadStatementPdf('c-1', period).subscribe();
    const pdf = httpTesting.expectOne((req) => req.url === `${base}/customers/c-1/statement/pdf`);
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['%PDF']));

    service.downloadStatementXlsx('c-1', period).subscribe();
    const xlsx = httpTesting.expectOne((req) => req.url === `${base}/customers/c-1/statement/xlsx`);
    expect(xlsx.request.responseType).toBe('blob');
    xlsx.flush(new Blob(['xlsx']));
  });

  it('queues the statement e-mail', () => {
    const payload = { from: '2026-01-01', to: '2026-03-31', recipient: 'ar@example.test', locale: 'de' as const };
    service.sendStatement('c-1', payload).subscribe();
    const request = httpTesting.expectOne(`${base}/customers/c-1/statement/send`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: { id: 's-1', status: 'queued', recipient: 'ar@example.test' } });
  });
});
