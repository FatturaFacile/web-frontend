import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SubscriptionsExtraApiService } from './subscriptions-extra-api.service';

describe('SubscriptionsExtraApiService', () => {
  let service: SubscriptionsExtraApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SubscriptionsExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SubscriptionsExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['pauseSubscription', 'POST', '/subscriptions/subscr-1/pause', () => service.pauseSubscription('subscr-1', {})],
    ['resumeSubscription', 'POST', '/subscriptions/subscr-1/resume', () => service.resumeSubscription('subscr-1', {})],
    ['cancelSubscription', 'POST', '/subscriptions/subscr-1/cancel', () => service.cancelSubscription('subscr-1', {})],
    ['billSubscription', 'POST', '/subscriptions/subscr-1/bill', () => service.billSubscription('subscr-1', {})],
    ['listSubscriptionRuns', 'GET', '/subscriptions/subscr-1/runs', () => service.listSubscriptionRuns('subscr-1')],
    ['getSubscription', 'GET', '/subscriptions/subscr-1', () => service.getSubscription('subscr-1')],
    ['updateSubscription', 'PUT', '/subscriptions/subscr-1', () => service.updateSubscription('subscr-1', {})],
    ['deleteSubscription', 'DELETE', '/subscriptions/subscr-1', () => service.deleteSubscription('subscr-1')],
    ['listPlans', 'GET', '/subscriptions/plans', () => service.listPlans()],
    ['createPlan', 'POST', '/subscriptions/plans', () => service.createPlan({})],
    ['getMetrics', 'GET', '/subscriptions/metrics', () => service.getMetrics()],
    ['saveDunningPolicy', 'PUT', '/subscriptions/dunning-policy', () => service.saveDunningPolicy({})],
    ['activateSubscription', 'POST', '/subscriptions/subscr-1/activate', () => service.activateSubscription('subscr-1', {})],
    ['suspendSubscription', 'POST', '/subscriptions/subscr-1/suspend', () => service.suspendSubscription('subscr-1', {})],
    ['reactivateSubscription', 'POST', '/subscriptions/subscr-1/reactivate', () => service.reactivateSubscription('subscr-1', {})],
    ['upgradeSubscription', 'POST', '/subscriptions/subscr-1/upgrade', () => service.upgradeSubscription('subscr-1', {})],
    ['downgradeSubscription', 'POST', '/subscriptions/subscr-1/downgrade', () => service.downgradeSubscription('subscr-1', {})],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.listSubscriptionRuns('subscr-1', { page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/subscriptions/subscr-1/runs'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
