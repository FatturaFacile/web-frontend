import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ChildcareExtraApiService } from './childcare-extra-api.service';

describe('ChildcareExtraApiService', () => {
  let api: ChildcareExtraApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/childcare`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ChildcareExtraApiService);
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

  it('handles children plans, fees, messages and meals', () => {
    api.addWeeklyPlan('c1', { valid_from: '2026-01-01', days: {} }).subscribe();
    expectCall('POST', '/children/c1/weekly-plans');
    api.assignFee('c1', { fee_plan_id: 'f', valid_from: '2026-01-01' }).subscribe();
    expectCall('POST', '/children/c1/fees');
    api.getMeals('2026-11-01').subscribe();
    expectCall('GET', '/meals');
    api.enrolInActivity('a1', { child_id: 'c1', valid_from: '2026-01-01' }).subscribe();
    expectCall('POST', '/activities/a1/enrolments');
    api.getMessages('c1').subscribe();
    expectCall('GET', '/children/c1/messages');
    api.sendMessage('c1', 'ciao').subscribe();
    expectCall('POST', '/children/c1/messages', { body: 'ciao' });
  });

  it('handles documents and subsidies', () => {
    api.uploadDocument('c1', { title: 'Doc' }).subscribe();
    expectCall('POST', '/children/c1/documents');
    api.downloadDocument('d1').subscribe();
    expectCall('GET', '/documents/d1/download');
    api.getSubsidyRules().subscribe();
    expectCall('GET', '/subsidy-rules');
    api.createSubsidyRule({ name: 'R', canton: 'TI', method: 'm', parameters: {}, valid_from: '2026-01-01' }).subscribe();
    expectCall('POST', '/subsidy-rules');
    api.verifySubsidyRule('r1', 'src').subscribe();
    expectCall('POST', '/subsidy-rules/r1/verify', { source_reference: 'src' });
    api.exportSubsidies('2026-10').subscribe();
    expectCall('GET', '/billing/subsidies/export');
  });
});
