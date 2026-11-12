import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, PermissionsService, SubscriptionApiService } from '@core';
import { icons } from '../../../icons-provider';
import { ContractChangesComponent } from './contract-changes.component';
import { SubscriptionBillingComponent } from './subscription-billing.component';

const ok = (data: unknown = []) => of({ success: true, message: 'ok', data });
const page = (data: unknown[] = []) => of({ success: true, message: 'ok', data, meta: { current_page: 1, total: data.length } });

describe('Subscription billing pages', () => {
  const api = {
    getContracts: vi.fn(),
    getPlans: vi.fn(),
    getContractDunning: vi.fn(),
    getProrationPreview: vi.fn(),
    upgradeContract: vi.fn(),
    changeContractQuantity: vi.fn(),
    suspendContract: vi.fn(),
    recordCollectionFailure: vi.fn(),
    getUsageEvents: vi.fn(),
    recordUsage: vi.fn(),
    getBillingRuns: vi.fn(),
    getBillingRun: vi.fn(),
    runBilling: vi.fn(),
    getRevenueContracts: vi.fn(),
    getSubscriptionForecast: vi.fn(),
    recognizeRevenue: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('it') };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getContracts.mockReturnValue(page());
    api.getPlans.mockReturnValue(page());
    api.getContractDunning.mockReturnValue(ok([]));
    api.getUsageEvents.mockReturnValue(page());
    api.getBillingRuns.mockReturnValue(page());
    api.getRevenueContracts.mockReturnValue(page());
    api.getSubscriptionForecast.mockReturnValue(ok({}));

    await TestBed.configureTestingModule({
      imports: [ContractChangesComponent, SubscriptionBillingComponent],
      providers: [
        provideNzIcons(icons),
        { provide: SubscriptionApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: i18n },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
  });

  it('previews the proration of an upgrade and then applies it with the effective date', () => {
    const fixture = TestBed.createComponent(ContractChangesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['selectContract']('c1');
    component['kind'] = 'upgrade';
    component['newPlanId'] = 'p2';
    component['effectiveDate'] = '2026-12-01';
    expect(component['canPreview']()).toBe(true);

    api.getProrationPreview.mockReturnValue(ok({ credit: '10.00', charge: '25.00' }));
    component['previewProration']();
    expect(api.getProrationPreview).toHaveBeenCalledWith('c1', {
      new_plan_id: 'p2',
      quantity: null,
      effective_date: '2026-12-01',
    });

    api.upgradeContract.mockReturnValue(ok({}));
    component['apply']();
    expect(api.upgradeContract).toHaveBeenCalledWith('c1', {
      new_plan_id: 'p2',
      quantity: null,
      effective_date: '2026-12-01',
      change_reason: null,
    });
  });

  it('validates each operation before it can be applied', () => {
    const component = TestBed.createComponent(ContractChangesComponent).componentInstance;
    expect(component['valid']()).toBe(false);
    component['selectContract']('c1');
    component['kind'] = 'quantity';
    expect(component['valid']()).toBe(false);
    component['quantity'] = '5';
    expect(component['valid']()).toBe(true);
    component['kind'] = 'collection';
    expect(component['valid']()).toBe(false);
    component['invoiceId'] = 'inv1';
    expect(component['valid']()).toBe(true);
    component['kind'] = 'suspend';
    expect(component['valid']()).toBe(true);
  });

  it('records a collection failure on the /sub/contracts endpoint', () => {
    const component = TestBed.createComponent(ContractChangesComponent).componentInstance;
    component['selectContract']('c1');
    component['kind'] = 'collection';
    component['invoiceId'] = 'inv1';
    component['reason'] = 'Card declined';
    api.recordCollectionFailure.mockReturnValue(ok({}));
    component['apply']();
    expect(api.recordCollectionFailure).toHaveBeenCalledWith('c1', { invoice_id: 'inv1', reason: 'Card declined' });
  });

  it('records usage with an idempotency key and runs billing', () => {
    const component = TestBed.createComponent(SubscriptionBillingComponent).componentInstance;
    component['itemId'] = 'si1';
    component['metricCode'] = 'api_calls';
    expect(component['usageValid']()).toBe(false);
    component['usageQuantity'] = '120';
    expect(component['usageValid']()).toBe(true);
    component['idempotencyKey'] = 'evt-1';
    api.recordUsage.mockReturnValue(ok({}));
    component['recordUsage']();
    expect(api.recordUsage).toHaveBeenCalledWith({
      subscription_item_id: 'si1',
      metric_code: 'api_calls',
      quantity: '120',
      idempotency_key: 'evt-1',
    });

    component['lookaheadDays'] = '3';
    api.runBilling.mockReturnValue(ok({}));
    component['runBilling']();
    expect(api.runBilling).toHaveBeenCalledWith({ run_date: null, lookahead_days: 3 });
  });

  it('recognizes revenue up to a period date', () => {
    const component = TestBed.createComponent(SubscriptionBillingComponent).componentInstance;
    component['periodDate'] = '2026-10-31';
    api.recognizeRevenue.mockReturnValue(ok({}));
    component['recognize']();
    expect(api.recognizeRevenue).toHaveBeenCalledWith('2026-10-31');
  });

  it('does not recognize revenue or run billing for a date in the future', () => {
    const component = TestBed.createComponent(SubscriptionBillingComponent).componentInstance;
    component['periodDate'] = '2999-01-01';
    component['runDate'] = '2999-01-01';
    component['recognize']();
    component['runBilling']();
    expect(api.recognizeRevenue).not.toHaveBeenCalled();
    expect(api.runBilling).not.toHaveBeenCalled();
  });
});
