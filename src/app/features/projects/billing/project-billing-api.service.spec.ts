import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ProjectBillingApiService } from './project-billing-api.service';

describe('ProjectBillingApiService', () => {
  let service: ProjectBillingApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/projects`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectBillingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads and saves the billing contract with its concurrency version', () => {
    service.contract('p1').subscribe();
    http.expectOne(`${base}/p1/billing-contract`).flush({ data: null });

    service
      .saveContract('p1', {
        billing_model: 'sal_progress',
        retention_guarantee_percent: 5,
        expected_version: 2,
      })
      .subscribe();
    const save = http.expectOne(`${base}/p1/billing-contract`);

    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({
      billing_model: 'sal_progress',
      retention_guarantee_percent: 5,
      expected_version: 2,
    });
    save.flush({ data: {} });
  });

  it('changes the status of the contract', () => {
    service.changeContractStatus('p1', 'active', 3).subscribe();
    const request = http.expectOne(`${base}/p1/billing-contract/status`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ billing_status: 'active', expected_version: 3 });
    request.flush({ data: {} });
  });

  it('previews and drafts the time and materials invoice up to a date', () => {
    service.timeAndMaterialsPreview('p1', '2027-03-31').subscribe();
    const preview = http.expectOne(
      (candidate) => candidate.url === `${base}/p1/billing/contract/time-and-materials`,
    );

    expect(preview.request.method).toBe('GET');
    expect(preview.request.params.get('up_to_date')).toBe('2027-03-31');
    preview.flush({ data: {} });

    service.draftTimeAndMaterials('p1', '2027-03-31', 22).subscribe();
    const draft = http.expectOne(`${base}/p1/billing/contract/time-and-materials`);

    expect(draft.request.method).toBe('POST');
    expect(draft.request.body).toEqual({ up_to_date: '2027-03-31', tax_rate: 22 });
    draft.flush({ data: {} });
  });

  it('bills a milestone of the contract', () => {
    service.billMilestone('p1', 'm1', 8.1).subscribe();
    const request = http.expectOne(`${base}/p1/billing/contract/milestones/m1`);

    expect(request.request.body).toEqual({ tax_rate: 8.1 });
    request.flush({ data: {} });
  });

  it('drives the SAL workflow: draft, submit, approve and invoice, cancel', () => {
    service
      .createSal('p1', {
        period_start_date: '2027-01-01',
        period_end_date: '2027-01-31',
        cumulative_completion_percent: 30,
      })
      .subscribe();
    service.submitSal('p1', 's1').subscribe();
    service.approveAndInvoiceSal('p1', 's1', 22, 'Mario').subscribe();
    service.cancelSal('p1', 's1', 'Disputed').subscribe();

    expect(http.expectOne(`${base}/p1/sal-certificates`).request.body).toEqual({
      period_start_date: '2027-01-01',
      period_end_date: '2027-01-31',
      cumulative_completion_percent: 30,
    });
    http.match(`${base}/p1/sal-certificates`).forEach((request) => request.flush({ data: {} }));
    http.expectOne(`${base}/p1/sal-certificates/s1/submit`).flush({ data: {} });

    const approve = http.expectOne(`${base}/p1/sal-certificates/s1/approve-and-invoice`);

    expect(approve.request.body).toEqual({ tax_rate: 22, approved_by: 'Mario' });
    approve.flush({ data: {} });

    const cancel = http.expectOne(`${base}/p1/sal-certificates/s1/cancel`);

    expect(cancel.request.body).toEqual({ reason: 'Disputed' });
    cancel.flush({ data: {} });
  });

  it('reads the retention and releases it in full or in part', () => {
    service.retention('p1').subscribe();
    http.expectOne(`${base}/p1/retention`).flush({ data: {} });

    service.releaseRetention('p1', { amount: 1000, acceptance_confirmed: true }).subscribe();
    const request = http.expectOne(`${base}/p1/retention/release`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ amount: 1000, acceptance_confirmed: true });
    request.flush({ data: {} });
  });

  it('reads the retainer, tops it up and burns hours against it', () => {
    service.retainer('p1').subscribe();
    http.expectOne(`${base}/p1/retainer`).flush({ data: {} });

    service.topUpRetainer('p1', { hours: 10 }).subscribe();
    expect(http.expectOne(`${base}/p1/retainer/top-up`).request.body).toEqual({ hours: 10 });
    http.match(`${base}/p1/retainer/top-up`).forEach((request) => request.flush({ data: {} }));

    service.consumeRetainer('p1', '2027-03-31').subscribe();
    const consume = http.expectOne(`${base}/p1/retainer/consume`);

    expect(consume.request.body).toEqual({ up_to_date: '2027-03-31' });
    consume.flush({ data: {} });
  });

  it('summarises the unbilled work of a project', () => {
    service.unbilledSummary('p1').subscribe();
    http.expectOne(`${base}/p1/billing/unbilled-summary`).flush({ data: {} });
  });

  it('lists the WIP runs of a period and runs the valuation of all open projects', () => {
    service.wipRuns({ periodEndDate: '2027-03-31', page: 2 }).subscribe();
    const list = http.expectOne((candidate) => candidate.url === `${base}/wip-valuations`);

    expect(list.request.params.get('period_end_date')).toBe('2027-03-31');
    expect(list.request.params.get('page')).toBe('2');
    expect(list.request.params.has('project_id')).toBe(false);
    list.flush({ data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } });

    service
      .runWip({ period_end_date: '2027-03-31', valuation_method: 'completed_contract' })
      .subscribe();
    const run = http.expectOne(`${base}/wip-valuations`);

    expect(run.request.method).toBe('POST');
    expect(run.request.body).toEqual({
      period_end_date: '2027-03-31',
      valuation_method: 'completed_contract',
    });
    run.flush({ data: { runs: [], skipped: [] } });
  });
});
