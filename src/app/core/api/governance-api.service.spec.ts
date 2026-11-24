import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GovRiskRequest } from '../models';
import { GovernanceApiService } from './governance-api.service';

describe('GovernanceApiService', () => {
  let service: GovernanceApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GovernanceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('reads the dashboard on the chosen basis', () => {
    service.getDashboard('inherent').subscribe();

    const req = httpMock.expectOne((request) => request.url.endsWith('/governance/dashboard'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('basis')).toBe('inherent');
    req.flush({ data: {} });
  });

  it('lists the risks with the filters of the API and drops the empty ones', () => {
    service.getRisks({ status: 'assessed', category: undefined, search: '', per_page: 100 }).subscribe();

    const req = httpMock.expectOne((request) => request.url.endsWith('/governance/risks'));
    expect(req.request.params.get('status')).toBe('assessed');
    expect(req.request.params.get('per_page')).toBe('100');
    expect(req.request.params.has('category')).toBe(false);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ data: [] });
  });

  it('sends the payload of the risk FormRequest and the status change with its notes', () => {
    const payload: GovRiskRequest = { title: 'Ransomware', category: 'it_security', likelihood: 4, impact: 5, residual_likelihood: 2, residual_impact: 3 };

    service.createRisk(payload).subscribe();
    const create = httpMock.expectOne((request) => request.url.endsWith('/governance/risks') && request.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });

    service.transitionRisk('r-1', { status: 'accepted', notes: 'Tolerated by the board' }).subscribe();
    const transition = httpMock.expectOne((request) => request.url.endsWith('/governance/risks/r-1/transition'));
    expect(transition.request.method).toBe('POST');
    expect(transition.request.body).toEqual({ status: 'accepted', notes: 'Tolerated by the board' });
    transition.flush({ data: {} });

    service.syncRiskControls('r-1', { control_ids: ['c-1'] }).subscribe();
    const controls = httpMock.expectOne((request) => request.url.endsWith('/governance/risks/r-1/controls'));
    expect(controls.request.method).toBe('PUT');
    expect(controls.request.body).toEqual({ control_ids: ['c-1'] });
    controls.flush({ data: {} });
  });

  it('records a control test and raises a remediation action under a finding', () => {
    service.recordControlTest('c-1', { tested_on: '2027-06-20', result: 'fail', raise_finding: true }).subscribe();
    const test = httpMock.expectOne((request) => request.url.endsWith('/governance/controls/c-1/tests'));
    expect(test.request.method).toBe('POST');
    expect(test.request.body.raise_finding).toBe(true);
    test.flush({ data: {} });

    service.createFindingAction('f-1', { title: 'Fix', owner_id: 'u-1', due_date: '2027-08-01' }).subscribe();
    const action = httpMock.expectOne((request) => request.url.endsWith('/governance/findings/f-1/actions'));
    expect(action.request.method).toBe('POST');
    action.flush({ data: {} });
  });

  it('seeds the compliance templates and completes an obligation', () => {
    service.seedObligationTemplates({ frameworks: ['gdpr', 'fadp'], first_due_date: '2027-07-15' }).subscribe((res) => {
      expect(res.data).toEqual({ created: 11, skipped: 0 });
    });
    const seed = httpMock.expectOne((request) => request.url.endsWith('/governance/obligations/seed-templates'));
    expect(seed.request.body).toEqual({ frameworks: ['gdpr', 'fadp'], first_due_date: '2027-07-15' });
    seed.flush({ data: { created: 11, skipped: 0 } });

    service.completeObligation('o-1', { completed_on: '2027-06-22' }).subscribe();
    const complete = httpMock.expectOne((request) => request.url.endsWith('/governance/obligations/o-1/complete'));
    expect(complete.request.body).toEqual({ completed_on: '2027-06-22' });
    complete.flush({ data: {} });
  });
});
