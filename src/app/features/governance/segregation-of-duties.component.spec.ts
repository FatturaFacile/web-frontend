import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GovernanceApiService } from '../../core/api/governance-api.service';
import { sodParseDuties } from './segregation-of-duties.component';

describe('segregation of duties', () => {
  let api: GovernanceApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(GovernanceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('parses the duties of a textarea into distinct non-empty values', () => {
    expect(sodParseDuties('treasury.write\n procurement.write ,treasury.write\n\n')).toEqual(['treasury.write', 'procurement.write']);
  });

  it('sends the payload of the SodRuleRequest and the exception request', () => {
    api.createSodRule({ code: 'SOD-9', title: 'Pay and approve', duties_a: ['a.write'], duties_b: ['b.write'], severity: 'block', is_active: true }).subscribe();
    const rule = httpMock.expectOne((request) => request.url.endsWith('/governance/sod/rules') && request.method === 'POST');
    expect(rule.request.body.severity).toBe('block');
    rule.flush({ data: {} });

    api.createSodException({ rule_id: 'r-1', user_id: 'u-1', justification: 'Temporary cover', expires_at: '2027-08-01' }).subscribe();
    const exception = httpMock.expectOne((request) => request.url.endsWith('/governance/sod/exceptions') && request.method === 'POST');
    expect(exception.request.body.expires_at).toBe('2027-08-01');
    exception.flush({ data: {} });

    api.revokeSodException('e-1').subscribe();
    httpMock.expectOne((request) => request.url.endsWith('/governance/sod/exceptions/e-1/revoke')).flush({ data: {} });
  });
});
