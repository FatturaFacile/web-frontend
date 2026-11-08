import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  CreatePlanPayload,
  CreateSubscriptionPayload,
  SubscriptionApiService,
  SubscriptionContractResource,
  SubscriptionMetrics,
  SubscriptionPlanResource,
} from '@core';

describe('SubscriptionApiService', () => {
  let service: SubscriptionApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SubscriptionApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SubscriptionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('manages subscription plans CRUD', () => {
    const mockPlans: SubscriptionPlanResource[] = [
      {
        id: 'plan-1',
        plan_code: 'PROF-MONTHLY',
        name: 'Professional Monthly',
        description: 'Standard plan',
        product_id: null,
        billing_interval: 'monthly',
        interval_count: 1,
        billing_alignment: 'anniversary',
        pricing_model: 'flat_fee',
        currency: 'CHF',
        setup_fee: '0.00',
        base_price: '49.00',
        tax_rate: '8.10',
        trial_period_days: 14,
        min_commitment_cycles: 1,
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    service.getPlans({ is_active: true }).subscribe((res) => {
      expect(res.data).toEqual(mockPlans);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/subscriptions/plans` && r.params.get('is_active') === 'true');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: mockPlans,
      meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
    });

    const createPayload: CreatePlanPayload = {
      plan_code: 'ENTERPRISE-ANNUAL',
      name: 'Enterprise Annual',
      billing_interval: 'annual',
      base_price: 990,
      currency: 'CHF',
    };

    service.createPlan(createPayload).subscribe((res) => {
      expect(res.data.id).toBe('plan-2');
    });

    const reqCreate = httpMock.expectOne(`${baseUrl}/subscriptions/plans`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, data: { id: 'plan-2', ...createPayload } });
  });

  it('manages subscription contracts lifecycle via /sub/contracts successor', () => {
    const mockContracts: SubscriptionContractResource[] = [
      {
        id: 'contract-1',
        contract_number: 'SUB-2026-001',
        name: 'Alpha SA Plan',
        customer_id: 'cust-1',
        customer_name: 'Alpha SA',
        plan_id: 'plan-1',
        plan_name: 'Professional Monthly',
        status: 'active',
        currency: 'CHF',
        mrr: '49.00',
        arr: '588.00',
        unit_price: '49.00',
        quantity: 1,
        start_date: '2026-01-01',
        current_period_start: '2026-11-01',
        current_period_end: '2026-11-30',
        trial_end_date: null,
        cancelled_at: null,
        paused_at: null,
        next_billing_date: '2026-12-01',
        auto_renew: true,
        payment_method: 'bank_transfer',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    service.getContracts({ status: 'active' }).subscribe((res) => {
      expect(res.data).toEqual(mockContracts);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/sub/contracts` && r.params.get('status') === 'active');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: mockContracts,
      meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
    });

    const createPayload: CreateSubscriptionPayload = {
      customer_id: 'cust-2',
      plan_id: 'plan-1',
      start_date: '2026-11-08',
      quantity: 5,
    };

    service.createContract(createPayload).subscribe((res) => {
      expect(res.data.id).toBe('contract-2');
    });

    const reqCreate = httpMock.expectOne(`${baseUrl}/sub/contracts`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, data: { id: 'contract-2', ...createPayload, status: 'trialing' } });

    service.activateContract('contract-2').subscribe((res) => {
      expect(res.data.status).toBe('active');
    });

    const reqActivate = httpMock.expectOne(`${baseUrl}/sub/contracts/contract-2/activate`);
    expect(reqActivate.request.method).toBe('POST');
    reqActivate.flush({ success: true, data: { id: 'contract-2', status: 'active' } });

    service.pauseContract('contract-2', { reason: 'Seasonal pause' }).subscribe((res) => {
      expect(res.data.status).toBe('paused');
    });

    const reqPause = httpMock.expectOne(`${baseUrl}/sub/contracts/contract-2/pause`);
    expect(reqPause.request.method).toBe('POST');
    reqPause.flush({ success: true, data: { id: 'contract-2', status: 'paused' } });

    service.billContract('contract-2').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const reqBill = httpMock.expectOne(`${baseUrl}/sub/contracts/contract-2/bill`);
    expect(reqBill.request.method).toBe('POST');
    reqBill.flush({ success: true, data: { billed: true } });
  });

  it('retrieves subscription metrics and triggers dunning run', () => {
    const mockMetrics: SubscriptionMetrics = {
      as_of: '2026-11-08',
      window_start: '2026-10-09',
      window_days: 30,
      mrr: '12500.00',
      arr: '150000.00',
      active_subscriptions: 142,
      trialing_subscriptions: 18,
      paying_customers: 120,
      net_new_mrr: '850.00',
      customer_churn_rate: '1.20',
      revenue_churn_rate: '0.90',
      arpa: '88.00',
      ltv: '4200.00',
    };

    service.getMetrics().subscribe((res) => {
      expect(res.data.mrr).toBe('12500.00');
      expect(res.data.active_subscriptions).toBe(142);
    });

    const reqMetrics = httpMock.expectOne(`${baseUrl}/subscriptions/metrics`);
    expect(reqMetrics.request.method).toBe('GET');
    reqMetrics.flush({ success: true, data: mockMetrics });

    service.runDunning().subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const reqDunning = httpMock.expectOne(`${baseUrl}/subscriptions/dunning/run`);
    expect(reqDunning.request.method).toBe('POST');
    reqDunning.flush({ success: true, data: { executed: true } });
  });
});
