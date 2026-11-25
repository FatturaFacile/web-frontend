import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { BudgetingApiService } from './budgeting-api.service';

describe('BudgetingApiService (budget control)', () => {
  let service: BudgetingApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/budgeting`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BudgetingApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BudgetingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the variance with the dimension filters and the decomposition', () => {
    service.getVariance('v1', 6, 'account', { cost_center_id: 'cc1', project_id: null }).subscribe();
    const variance = http.expectOne((req) => req.url === `${base}/versions/v1/variance`);
    expect(variance.request.params.get('cost_center_id')).toBe('cc1');
    expect(variance.request.params.has('project_id')).toBe(false);
    expect(variance.request.params.get('through_period')).toBe('6');
    variance.flush({ data: {} });

    service.getDecomposition('v1', 12, 'cost_center').subscribe();
    const decomposition = http.expectOne((req) => req.url === `${base}/versions/v1/variance/decomposition`);
    expect(decomposition.request.params.get('group_by')).toBe('cost_center');
    decomposition.flush({ data: {} });
  });

  it('reads and saves the grid and runs the version actions', () => {
    service.getGrid('v1').subscribe();
    http.expectOne(`${base}/versions/v1/grid`).flush({ data: {} });

    service.saveGrid('v1', [{ account_id: 'a', cost_center_id: null, project_id: null, slot: 1, amount: '10' }]).subscribe();
    const save = http.expectOne(`${base}/versions/v1/grid`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ cells: [{ account_id: 'a', cost_center_id: null, project_id: null, slot: 1, amount: '10' }] });
    save.flush({ data: { saved: 1 } });

    service.reviseVersion('v1', { reason: 'Mid-year' }).subscribe();
    const revise = http.expectOne(`${base}/versions/v1/revise`);
    expect(revise.request.method).toBe('POST');
    expect(revise.request.body).toEqual({ reason: 'Mid-year' });
    revise.flush({ data: {} });
  });

  it('posts scenarios, transfers and roll forwards and reads the audit trail', () => {
    service.createScenario('v1', { name: 'Best', scenario_kind: 'best_case', adjustment_percent: -5 }).subscribe();
    http.expectOne(`${base}/versions/v1/scenario`).flush({ data: {} });

    service.transferBudget('v1', { from: { account_id: 'a', cost_center_id: null, project_id: null }, to: { account_id: 'b', cost_center_id: null, project_id: null }, period: 2, amount: '5' }).subscribe();
    http.expectOne(`${base}/versions/v1/transfer`).flush(null, { status: 204, statusText: 'No Content' });

    service.rollForward('v1', { shift_months: 3 }).subscribe();
    http.expectOne(`${base}/versions/v1/roll-forward`).flush({ data: {} });

    service.getVersionAudit('v1').subscribe();
    http.expectOne(`${base}/versions/v1/audit`).flush({ data: [] });
  });

  it('downloads the template and the pack as blobs and uploads the import as a form', () => {
    service.downloadImportTemplate('v1').subscribe();
    const template = http.expectOne(`${base}/versions/v1/import-template`);
    expect(template.request.responseType).toBe('blob');
    template.flush(new Blob(['x']));

    service.downloadExecutivePack('v1', 9).subscribe();
    const pack = http.expectOne((req) => req.url === `${base}/versions/v1/executive-pack`);
    expect(pack.request.responseType).toBe('blob');
    expect(pack.request.params.get('through_period')).toBe('9');
    pack.flush(new Blob(['x']));

    service.importBudget('v1', new File(['a'], 'budget.xlsx'), 'replace', true).subscribe();
    const upload = http.expectOne(`${base}/versions/v1/import`);
    const body = upload.request.body as FormData;
    expect(body.get('mode')).toBe('replace');
    expect(body.get('validate_only')).toBe('1');
    expect((body.get('file') as File).name).toBe('budget.xlsx');
    upload.flush({ data: {} });

    service.getImports('v1').subscribe();
    http.expectOne(`${base}/versions/v1/imports`).flush({ data: [] });
  });

  it('manages the actual volumes', () => {
    service.getActualVolumes({ month: '2028-01' }).subscribe();
    const list = http.expectOne((req) => req.url === `${base}/actual-volumes`);
    expect(list.request.params.get('month')).toBe('2028-01');
    list.flush({ data: [] });

    service.saveActualVolume({ account_id: 'a', cost_center_id: null, project_id: null, month: '2028-01', quantity: '10' }).subscribe();
    http.expectOne(`${base}/actual-volumes`).flush({ data: {} });

    service.deleteActualVolume('av1').subscribe();
    expect(http.expectOne(`${base}/actual-volumes/av1`).request.method).toBe('DELETE');
  });

  it('reads the availability, checks a spend and reads the commitments, the controls and the settings', () => {
    service.getAvailability({ cost_center_id: 'cc1' }).subscribe();
    const availability = http.expectOne((req) => req.url === `${base}/spend-control/availability`);
    expect(availability.request.params.get('cost_center_id')).toBe('cc1');
    availability.flush({ data: {} });

    service.checkSpend({ source_type: 'purchase_order', amount: '100' }).subscribe();
    const check = http.expectOne(`${base}/spend-control/check`);
    expect(check.request.method).toBe('POST');
    check.flush({ data: {} });

    service.getCommitments({ status: 'open' }).subscribe();
    http.expectOne((req) => req.url === `${base}/spend-control/commitments` && req.params.get('status') === 'open').flush({ data: [] });

    service.getSpendChecks({ outcome: 'blocked' }).subscribe();
    http.expectOne((req) => req.url === `${base}/spend-control/checks` && req.params.get('outcome') === 'blocked').flush({ data: [] });

    service.getSettings().subscribe();
    http.expectOne(`${base}/spend-control/settings`).flush({ data: {} });

    service.updateSettings({ red_threshold_percent: '12' }).subscribe();
    const settings = http.expectOne(`${base}/spend-control/settings`);
    expect(settings.request.method).toBe('PUT');
    settings.flush({ data: {} });
  });

  it('manages the spend rules', () => {
    service.getRules().subscribe();
    http.expectOne((req) => req.url === `${base}/spend-control/rules`).flush({ data: [] });

    const payload = { name: 'Block', account_id: null, cost_center_id: null, project_id: null, mode: 'hard_block' as const, threshold_percent: 100, document_types: ['purchase_order' as const], stages: ['approve' as const], enforce_without_budget: false, priority: 0, is_active: true };
    service.createRule(payload).subscribe();
    http.expectOne(`${base}/spend-control/rules`).flush({ data: {} });

    service.updateRule('r1', { priority: 5 }).subscribe();
    expect(http.expectOne(`${base}/spend-control/rules/r1`).request.method).toBe('PUT');

    service.deleteRule('r1').subscribe();
    expect(http.expectOne(`${base}/spend-control/rules/r1`).request.method).toBe('DELETE');
  });

  it('runs the override workflow', () => {
    service.getOverrides({ status: 'pending' }).subscribe();
    http.expectOne((req) => req.url === `${base}/spend-control/overrides` && req.params.get('status') === 'pending').flush({ data: [] });

    service.requestOverride({ scope: 'document', source_type: 'purchase_order', source_id: 'po1', requested_amount: '10', reason: 'Urgent repair' }).subscribe();
    http.expectOne(`${base}/spend-control/overrides`).flush({ data: {} });

    service.approveOverride('o1', { approved_amount: '8' }).subscribe();
    expect(http.expectOne(`${base}/spend-control/overrides/o1/approve`).request.body).toEqual({ approved_amount: '8' });

    service.rejectOverride('o1', { comment: 'No' }).subscribe();
    http.expectOne(`${base}/spend-control/overrides/o1/reject`);

    service.cancelOverride('o1').subscribe();
    http.expectOne(`${base}/spend-control/overrides/o1/cancel`);

    service.getOverrideHistory('o1').subscribe();
    http.expectOne(`${base}/spend-control/overrides/o1/history`);
  });
});
