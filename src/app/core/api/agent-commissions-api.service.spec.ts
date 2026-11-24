import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AgentCommissionsApiService } from './agent-commissions-api.service';

describe('AgentCommissionsApiService', () => {
  let service: AgentCommissionsApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/agent-commissions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AgentCommissionsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AgentCommissionsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads the lookups and the representatives without an agent profile', () => {
    service.getLookups().subscribe();
    httpTesting.expectOne(`${base}/lookups`).flush({ data: {} });

    service.getAvailableRepresentatives().subscribe();
    const request = httpTesting.expectOne(`${base}/representatives/available`);
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('lists agents with the filters and creates, updates and deletes a profile', () => {
    service.listAgents({ agent_type: 'sub_agent', is_active: true }).subscribe();
    const list = httpTesting.expectOne((req) => req.url === `${base}/agents`);
    expect(list.request.params.get('agent_type')).toBe('sub_agent');
    expect(list.request.params.get('is_active')).toBe('true');
    list.flush({ data: [] });

    service.createAgent({ sales_representative_id: 'r-1', agent_type: 'direct' }).subscribe();
    const create = httpTesting.expectOne(`${base}/agents`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ sales_representative_id: 'r-1', agent_type: 'direct' });
    create.flush({ data: {} });

    service.updateAgent('a-1', { default_rate: 7 }).subscribe();
    const update = httpTesting.expectOne(`${base}/agents/a-1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ default_rate: 7 });
    update.flush({ data: {} });

    service.deleteAgent('a-1').subscribe();
    const remove = httpTesting.expectOne(`${base}/agents/a-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ data: null });

    service.getAgent('a-2').subscribe();
    httpTesting.expectOne(`${base}/agents/a-2`).flush({ data: {} });
  });

  it('manages the zones', () => {
    service.listZones().subscribe();
    httpTesting.expectOne(`${base}/zones`).flush({ data: [] });

    service.createZone({ code: 'NORD', name: 'North', regions: ['MI'] }).subscribe();
    const create = httpTesting.expectOne(`${base}/zones`);
    expect(create.request.method).toBe('POST');
    create.flush({ data: {} });

    service.updateZone('z-1', { name: 'North West' }).subscribe();
    const update = httpTesting.expectOne(`${base}/zones/z-1`);
    expect(update.request.method).toBe('PUT');
    update.flush({ data: {} });

    service.deleteZone('z-1').subscribe();
    expect(httpTesting.expectOne(`${base}/zones/z-1`).request.method).toBe('DELETE');
  });

  it('manages the rules with their tiers and simulates the precedence', () => {
    service.listRules('a-1').subscribe();
    const list = httpTesting.expectOne((req) => req.url === `${base}/rules`);
    expect(list.request.params.get('agent_profile_id')).toBe('a-1');
    list.flush({ data: [] });

    service.listRules().subscribe();
    const all = httpTesting.expectOne((req) => req.url === `${base}/rules`);
    expect(all.request.params.has('agent_profile_id')).toBe(false);
    all.flush({ data: [] });

    const tiers = [{ threshold_from: 0, threshold_to: 10000, rate: 3 }];
    service.createRule({ name: 'Tiered', rate_type: 'percentage', tiers }).subscribe();
    const create = httpTesting.expectOne(`${base}/rules`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.tiers).toEqual(tiers);
    create.flush({ data: {} });

    service.updateRule('r-1', { priority: 5 }).subscribe();
    expect(httpTesting.expectOne(`${base}/rules/r-1`).request.method).toBe('PUT');

    service.deleteRule('r-1').subscribe();
    expect(httpTesting.expectOne(`${base}/rules/r-1`).request.method).toBe('DELETE');

    service
      .resolveRule({
        agent_profile_id: 'a-1',
        customer_id: 'c-1',
        product_category_id: null,
        date: '2026-03-10',
      })
      .subscribe();
    const resolve = httpTesting.expectOne((req) => req.url === `${base}/rules/resolve`);
    expect(resolve.request.params.get('agent_profile_id')).toBe('a-1');
    expect(resolve.request.params.get('customer_id')).toBe('c-1');
    expect(resolve.request.params.has('product_category_id')).toBe(false);
    expect(resolve.request.params.get('date')).toBe('2026-03-10');
    resolve.flush({ data: {} });
  });

  it('saves the fiscal override with a PUT on the collection and removes it by id', () => {
    service.listFiscalParameters().subscribe();
    httpTesting.expectOne(`${base}/fiscal-parameters`).flush({ data: [] });

    service.saveFiscalOverride({ code: 'vat_rate', year: 2026, value: 22 }).subscribe();
    const save = httpTesting.expectOne(`${base}/fiscal-parameters`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ code: 'vat_rate', year: 2026, value: 22 });
    save.flush({ data: {} });

    service.deleteFiscalOverride('p-1').subscribe();
    const remove = httpTesting.expectOne(`${base}/fiscal-parameters/p-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ data: null });
  });

  it('reads the ledger with its filters, one entry with its movements, and synchronises', () => {
    service
      .listLedger({
        agent_profile_id: 'a-1',
        status: 'awaiting_reconciliation',
        accrual_basis: 'collected',
        from: '2026-01-01',
        to: '2026-03-31',
        search: 'FA-1',
        page: 2,
        per_page: 25,
      })
      .subscribe();
    const ledger = httpTesting.expectOne((req) => req.url === `${base}/ledger`);
    expect(ledger.request.params.get('status')).toBe('awaiting_reconciliation');
    expect(ledger.request.params.get('accrual_basis')).toBe('collected');
    expect(ledger.request.params.get('search')).toBe('FA-1');
    expect(ledger.request.params.get('per_page')).toBe('25');
    expect(ledger.request.params.get('page')).toBe('2');
    ledger.flush({ data: [], meta: { totals: {} } });

    service.getLedgerEntry('e-1').subscribe();
    httpTesting.expectOne(`${base}/ledger/e-1`).flush({ data: {} });

    service.sync({ from: '2026-01-01', to: '2026-03-31' }).subscribe();
    const sync = httpTesting.expectOne(`${base}/sync`);
    expect(sync.request.method).toBe('POST');
    expect(sync.request.body).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    sync.flush({ data: { period_invoices: 3, open_invoices: 1 } });
  });

  it('reads the Enasarco overview of a year, for one agent when given', () => {
    service.getEnasarcoOverview(2026, 'a-1').subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/enasarco/overview`);
    expect(request.request.params.get('year')).toBe('2026');
    expect(request.request.params.get('agent_profile_id')).toBe('a-1');
    request.flush({ data: [], meta: { year: 2026 } });
  });

  it('lists, previews, generates and reads statements', () => {
    service
      .listStatements({ agent_profile_id: 'a-1', status: 'draft', year: 2026, page: 3 })
      .subscribe();
    const list = httpTesting.expectOne((req) => req.url === `${base}/statements`);
    expect(list.request.params.get('status')).toBe('draft');
    expect(list.request.params.get('year')).toBe('2026');
    expect(list.request.params.get('page')).toBe('3');
    list.flush({ data: [], meta: {} });

    const payload = {
      agent_profile_id: 'a-1',
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      period_type: 'monthly' as const,
    };
    service.previewStatement(payload).subscribe();
    const preview = httpTesting.expectOne(`${base}/statements/preview`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual(payload);
    preview.flush({ data: {} });

    service.generateStatement(payload).subscribe();
    const generate = httpTesting.expectOne(`${base}/statements`);
    expect(generate.request.method).toBe('POST');
    expect(generate.request.body).toEqual(payload);
    generate.flush({ data: {} });

    service.getStatement('s-1').subscribe();
    httpTesting.expectOne(`${base}/statements/s-1`).flush({ data: {} });
  });

  it('runs the statement workflow actions with their bodies', () => {
    service.approveStatement('s-1').subscribe();
    const approve = httpTesting.expectOne(`${base}/statements/s-1/approve`);
    expect(approve.request.method).toBe('POST');
    expect(approve.request.body).toEqual({});
    approve.flush({ data: {} });

    service.voidStatement('s-1').subscribe();
    expect(httpTesting.expectOne(`${base}/statements/s-1/void`).request.method).toBe('POST');

    service.prepareSelfBilling('s-1', '2026-04-02').subscribe();
    const billing = httpTesting.expectOne(`${base}/statements/s-1/self-billing`);
    expect(billing.request.body).toEqual({ date: '2026-04-02' });
    billing.flush({ data: {} });

    service.prepareSelfBilling('s-1').subscribe();
    const noDate = httpTesting.expectOne(`${base}/statements/s-1/self-billing`);
    expect(noDate.request.body).toEqual({});
    noDate.flush({ data: {} });

    service.payStatement('s-1', { reference: 'BON-1', paid_on: '2026-04-05' }).subscribe();
    const pay = httpTesting.expectOne(`${base}/statements/s-1/pay`);
    expect(pay.request.body).toEqual({ reference: 'BON-1', paid_on: '2026-04-05' });
    pay.flush({ data: {} });

    service.sendStatement('s-1', { recipient: 'agent@example.test' }).subscribe();
    const send = httpTesting.expectOne(`${base}/statements/s-1/send`);
    expect(send.request.body).toEqual({ recipient: 'agent@example.test' });
    send.flush({ data: {} });
  });

  it('downloads the statement PDF and the CSV exports as blobs', () => {
    service.downloadStatementPdf('s-1').subscribe();
    const pdf = httpTesting.expectOne(`${base}/statements/s-1/pdf`);
    expect(pdf.request.method).toBe('GET');
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['%PDF']));

    service.exportCu(2026).subscribe();
    const cu = httpTesting.expectOne((req) => req.url === `${base}/exports/cu`);
    expect(cu.request.responseType).toBe('blob');
    expect(cu.request.params.get('year')).toBe('2026');
    cu.flush(new Blob(['a;b']));

    service.exportEnasarco(2026, 2).subscribe();
    const enasarco = httpTesting.expectOne((req) => req.url === `${base}/exports/enasarco`);
    expect(enasarco.request.responseType).toBe('blob');
    expect(enasarco.request.params.get('year')).toBe('2026');
    expect(enasarco.request.params.get('quarter')).toBe('2');
    enasarco.flush(new Blob(['a;b']));

    service.exportEnasarco(2026).subscribe();
    const whole = httpTesting.expectOne((req) => req.url === `${base}/exports/enasarco`);
    expect(whole.request.params.has('quarter')).toBe(false);
    whole.flush(new Blob(['a;b']));
  });
});
