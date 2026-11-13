import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AuthStore,
  SubscriptionApiService,
  SubscriptionContractResource,
  SubscriptionMetrics,
  SubscriptionPlanResource,
} from '@core';
import { SubscriptionsComponent } from './subscriptions.component';

describe('SubscriptionsComponent', () => {
  let fixture: ComponentFixture<SubscriptionsComponent>;
  let component: SubscriptionsComponent;

  const mockMetrics: SubscriptionMetrics = {
    as_of: '2026-11-08',
    window_start: '2026-10-09',
    window_days: 30,
    mrr: '15000.00',
    arr: '180000.00',
    active_subscriptions: 150,
    trialing_subscriptions: 10,
    paying_customers: 140,
    net_new_mrr: '1200.00',
    customer_churn_rate: '1.50',
    revenue_churn_rate: '1.10',
    arpa: '100.00',
    ltv: '5000.00',
  };

  const mockPlans: SubscriptionPlanResource[] = [
    {
      id: 'plan-1',
      plan_code: 'BUSINESS-MONTHLY',
      name: 'Business Monthly',
      description: null,
      product_id: null,
      billing_interval: 'monthly',
      interval_count: 1,
      billing_alignment: 'anniversary',
      pricing_model: 'flat_fee',
      currency: 'CHF',
      setup_fee: null,
      base_price: '79.00',
      tax_rate: null,
      trial_period_days: 14,
      min_commitment_cycles: 1,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  const mockContracts: SubscriptionContractResource[] = [
    {
      id: 'contract-1',
      contract_number: 'SUB-2026-001',
      name: 'Alpha Plan',
      customer_id: 'cust-1',
      customer_name: 'Alpha SA',
      plan_id: 'plan-1',
      plan_name: 'Business Monthly',
      status: 'active',
      currency: 'CHF',
      mrr: '79.00',
      arr: '948.00',
      unit_price: '79.00',
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

  const mockSubApi = {
    getMetrics: vi.fn().mockReturnValue(of({ success: true, data: mockMetrics })),
    getPlans: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockPlans,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    getContracts: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockContracts,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createContract: vi.fn().mockReturnValue(of({ success: true, data: mockContracts[0] })),
    activateContract: vi.fn().mockReturnValue(of({ success: true, data: mockContracts[0] })),
    pauseContract: vi.fn().mockReturnValue(of({ success: true, data: { ...mockContracts[0], status: 'paused' } })),
    reactivateContract: vi.fn().mockReturnValue(of({ success: true, data: { ...mockContracts[0], status: 'active' } })),
    billContract: vi.fn().mockReturnValue(of({ success: true, data: null })),
    cancelContract: vi.fn().mockReturnValue(of({ success: true, data: { ...mockContracts[0], status: 'cancelled' } })),
    runDunning: vi.fn().mockReturnValue(of({ success: true, data: null })),
  };

  const mockMessage = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };


  const mockAuthStore = {
    activeCurrency: vi.fn().mockReturnValue('CHF'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [SubscriptionsComponent],
      providers: [
        provideNzIcons(icons),
        { provide: SubscriptionApiService, useValue: mockSubApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionsComponent);
    component = fixture.componentInstance;
  });

  it('loads metrics, plans, and contracts on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockSubApi.getMetrics).toHaveBeenCalled();
    expect(mockSubApi.getPlans).toHaveBeenCalled();
    expect(mockSubApi.getContracts).toHaveBeenCalled();
    expect(component.metrics()).toEqual(mockMetrics);
    expect(component.plans()).toEqual(mockPlans);
    expect(component.contracts()).toEqual(mockContracts);
    expect(component.total()).toBe(1);
  });

  it('filters contracts on search query change', () => {
    fixture.detectChanges();
    const event = { target: { value: 'Alpha' } } as unknown as Event;
    component.onSearch(event);

    expect(component.searchTerm()).toBe('Alpha');
    expect(mockSubApi.getContracts).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Alpha', page: 1 }),
    );
  });

  it('submits create subscription contract form', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.contractForm.patchValue({
      customer_id: 'cust-2',
      plan_id: 'plan-1',
      name: 'Custom Tier',
      start_date: '2026-11-10',
      quantity: 3,
    });

    component.submitCreateContract();

    expect(mockSubApi.createContract).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'cust-2',
        plan_id: 'plan-1',
        name: 'Custom Tier',
        start_date: '2026-11-10',
        quantity: 3,
      }),
    );
    expect(mockMessage.success).toHaveBeenCalledWith('subscriptions.msgSubscriptionContractCreated');
    expect(component.createModalVisible()).toBe(false);
  });

  it('does not create a contract from an empty form', () => {
    fixture.detectChanges();
    component.openCreateModal();

    component.submitCreateContract();

    expect(mockSubApi.createContract).not.toHaveBeenCalled();
    expect(component.contractForm.controls.customer_id.hasError('required')).toBe(true);
  });

  it('triggers lifecycle actions on contracts (bill now, pause, reactivate)', () => {
    fixture.detectChanges();
    component.billNow(mockContracts[0]);
    expect(mockSubApi.billContract).toHaveBeenCalledWith('contract-1');
    expect(mockMessage.success).toHaveBeenCalledWith('subscriptions.msgInvoiceGeneratedForCurrentBillingPeriod');

    component.pause(mockContracts[0]);
    expect(mockSubApi.pauseContract).toHaveBeenCalledWith('contract-1', expect.anything());

    component.reactivate(mockContracts[0]);
    expect(mockSubApi.reactivateContract).toHaveBeenCalledWith('contract-1');
  });

  it('triggers manual dunning process', () => {
    fixture.detectChanges();
    component.triggerDunning();

    expect(mockSubApi.runDunning).toHaveBeenCalled();
    expect(mockMessage.success).toHaveBeenCalledWith('subscriptions.msgAutomatedDunningRunExecuted');
    expect(component.runningDunning()).toBe(false);
  });
});
