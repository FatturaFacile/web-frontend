import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { QualityExtraApiService } from './quality-extra-api.service';

describe('QualityExtraApiService', () => {
  let api: QualityExtraApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/quality`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(QualityExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  function expectCall(method: string, path: string, body?: unknown): void {
    const req = http.expectOne((r) => r.url === `${base}${path}`);
    expect(req.request.method).toBe(method);
    if (body !== undefined) {
      expect(req.request.body).toEqual(body);
    }
    req.flush(req.request.responseType === 'blob' ? new Blob(['x']) : { data: {} });
  }

  it('reads and edits SPC characteristics, instruments and complaints', () => {
    api.getCharacteristic('c1').subscribe();
    expectCall('GET', '/spc/characteristics/c1');
    api.updateCharacteristic('c1', { name: 'X' }).subscribe();
    expectCall('PUT', '/spc/characteristics/c1', { name: 'X' });
    api.getSpcSamples('c1').subscribe();
    expectCall('GET', '/spc/characteristics/c1/samples');
    api.getInstrument('i1').subscribe();
    expectCall('GET', '/instruments/i1');
    api.getComplaint('k1').subscribe();
    expectCall('GET', '/complaints/k1');
    api.updateComplaint('k1', { description: 'd' }).subscribe();
    expectCall('PUT', '/complaints/k1', { description: 'd' });
    api.linkComplaint('k1', { capa_action_id: 'a1' }).subscribe();
    expectCall('POST', '/complaints/k1/link', { capa_action_id: 'a1' });
    api.raiseComplaintNonconformity('k1').subscribe();
    expectCall('POST', '/complaints/k1/raise-nonconformity', {});
  });

  it('manages nonconformities', () => {
    api.getNonconformities({ status: 'open' }).subscribe();
    expectCall('GET', '/nonconformities');
    api.getNonconformity('n1').subscribe();
    expectCall('GET', '/nonconformities/n1');
    api.createNonconformity({ title: 'T', source: 'internal' }).subscribe();
    expectCall('POST', '/nonconformities', { title: 'T', source: 'internal' });
    api.updateNonconformity('n1', { root_cause: 'r' }).subscribe();
    expectCall('PUT', '/nonconformities/n1', { root_cause: 'r' });
    api.investigateNonconformity('n1').subscribe();
    expectCall('POST', '/nonconformities/n1/investigate', { owner_id: null });
    api.closeNonconformity('n1', 'ok').subscribe();
    expectCall('POST', '/nonconformities/n1/close', { closure_notes: 'ok' });
    api.cancelNonconformity('n1', 'dup').subscribe();
    expectCall('POST', '/nonconformities/n1/cancel', { reason: 'dup' });
  });

  it('manages CAPA actions', () => {
    api.getCapaActions().subscribe();
    expectCall('GET', '/capa-actions');
    api.getCapaAction('a1').subscribe();
    expectCall('GET', '/capa-actions/a1');
    api.createCapaAction({ title: 'T', owner_id: 'u', due_date: '2026-12-01' }).subscribe();
    expectCall('POST', '/capa-actions');
    api.updateCapaAction('a1', { title: 'N' }).subscribe();
    expectCall('PUT', '/capa-actions/a1', { title: 'N' });
    api.startCapaAction('a1').subscribe();
    expectCall('POST', '/capa-actions/a1/start', {});
    api.completeCapaAction('a1').subscribe();
    expectCall('POST', '/capa-actions/a1/complete', { effectiveness_check_due_date: null });
    api.verifyCapaEffectiveness('a1', { result: 'effective' }).subscribe();
    expectCall('POST', '/capa-actions/a1/verify-effectiveness', { result: 'effective' });
    api.cancelCapaAction('a1').subscribe();
    expectCall('POST', '/capa-actions/a1/cancel', {});
  });

  it('manages audits', () => {
    api.getAudits().subscribe();
    expectCall('GET', '/audits');
    api.getAudit('u1').subscribe();
    expectCall('GET', '/audits/u1');
    api.createAudit({ title: 'T', planned_date: '2026-12-01' }).subscribe();
    expectCall('POST', '/audits');
    api.updateAudit('u1', { title: 'N' }).subscribe();
    expectCall('PUT', '/audits/u1', { title: 'N' });
    api.startAudit('u1').subscribe();
    expectCall('POST', '/audits/u1/start', {});
    api.completeAudit('u1', 'sum').subscribe();
    expectCall('POST', '/audits/u1/complete', { summary: 'sum' });
    api.cancelAudit('u1').subscribe();
    expectCall('POST', '/audits/u1/cancel', {});
    api.recordAuditChecklistResult('u1', 'it1', { result: 'conform' }).subscribe();
    expectCall('PUT', '/audits/u1/checklist/it1', { result: 'conform' });
    api.addAuditFinding('u1', { classification: 'minor', description: 'd' }).subscribe();
    expectCall('POST', '/audits/u1/findings');
  });

  it('manages procedures', () => {
    api.getProcedures().subscribe();
    expectCall('GET', '/procedures');
    api.getProcedure('p1').subscribe();
    expectCall('GET', '/procedures/p1');
    api.createProcedure({ code: 'P', title: 'T' }).subscribe();
    expectCall('POST', '/procedures');
    api.updateProcedure('p1', { title: 'N' }).subscribe();
    expectCall('PUT', '/procedures/p1', { title: 'N' });
    api.submitProcedure('p1').subscribe();
    expectCall('POST', '/procedures/p1/submit', {});
    api.approveProcedure('p1').subscribe();
    expectCall('POST', '/procedures/p1/approve', {});
    api.rejectProcedure('p1', 'no').subscribe();
    expectCall('POST', '/procedures/p1/reject', { reason: 'no' });
    api.reviseProcedure('p1').subscribe();
    expectCall('POST', '/procedures/p1/revise', {});
    api.obsoleteProcedure('p1').subscribe();
    expectCall('POST', '/procedures/p1/obsolete', {});
  });
});
