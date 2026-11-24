import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { BillingContract, RetainerState, SalCertificate } from './project-billing.models';
import { ProjectBillingComponent } from './project-billing.component';

const CONTRACT: BillingContract = {
  id: 'c1',
  project_id: 'p1',
  customer_id: 'k1',
  billing_model: 'hybrid',
  fiscal_jurisdiction: 'IT',
  currency_code: 'EUR',
  contract_total_value: '100000.0000',
  advance_payment_percent: '10.0000',
  advance_payment_amount: '0.0000',
  advance_recouped_amount: '3000.0000',
  retention_guarantee_percent: '5.0000',
  retention_release_rule: 'on_acceptance',
  retention_release_date: null,
  cap_amount: null,
  markup_percent: '0.0000',
  rate_card_id: null,
  prepaid_hours_allowance: '40.0000',
  prepaid_amount_allowance: '0.0000',
  low_balance_alert_threshold_percent: '25.0000',
  low_balance_alerted_at: null,
  cig: null,
  cup: null,
  contract_reference: null,
  contract_date: null,
  billing_status: 'active',
  version: 2,
};

const SAL: SalCertificate = {
  id: 's1',
  project_id: 'p1',
  billing_contract_id: 'c1',
  sal_number: 1,
  period_start_date: '2027-01-01',
  period_end_date: '2027-01-31',
  previous_completion_percent: '0.0000',
  cumulative_completion_percent: '30.0000',
  cumulative_gross_earned_value: '30000.0000',
  previous_sal_cumulative_billed: '0.0000',
  current_period_gross_sal: '30000.0000',
  advance_deduction_amount: '3000.0000',
  guarantee_retention_withheld: '1500.0000',
  invoice_amount: '27000.0000',
  net_billable_amount: '25500.0000',
  is_final: false,
  status: 'pending_approval',
  customer_approved_at: null,
  customer_approved_by: null,
  sales_invoice_id: null,
  notes: null,
};

const RETAINER: RetainerState = {
  balance: {
    unit: 'hours',
    allowance_hours: '40.00',
    allowance_amount: '0.00',
    topped_up_hours: '0.00',
    topped_up_amount: '0.00',
    consumed_hours: '36.00',
    consumed_amount: '2880.00',
    remaining_hours: '4.00',
    remaining_amount: '0.00',
    remaining_percent: '10.00',
    low_balance_threshold_percent: '25.00',
    is_low_balance: true,
  },
  entries: [],
};

function answer(request: TestRequest, contract: BillingContract | null): void {
  const url = request.request.url;

  if (url.includes('/translations/')) {
    request.flush({ translations: {} });
  } else if (url.endsWith('/billing-contract')) {
    request.flush({ data: contract });
  } else if (url.endsWith('/billing/unbilled-summary')) {
    request.flush({
      data: {
        project_id: 'p1',
        currency: 'EUR',
        billing_model: contract?.billing_model ?? null,
        contract_value: '100000.00',
        billed_to_date: '27000.00',
        draft_billing: '0.00',
        unbilled_time_and_materials: '240.00',
        unbilled_milestones: 1,
        open_sal_certificates: 1,
        open_sal_invoice_amount: '27000.00',
        retention: {
          withheld: '1500.00',
          released: '0.00',
          balance: '1500.00',
          release_rule: 'on_acceptance',
          release_date: null,
        },
        latest_wip_run: {
          period_end_date: '2027-03-31',
          recognized_revenue_to_date: '40000.00',
          billed_to_date: '27000.00',
          wip_asset_or_deferred_revenue_diff: '13000.00',
          nature: 'contract_asset',
        },
      },
    });
  } else if (url.endsWith('/sal-certificates')) {
    request.flush({ data: [SAL] });
  } else if (url.endsWith('/retention')) {
    request.flush({
      data: {
        withheld: '1500.00',
        released: '0.00',
        balance: '1500.00',
        release_rule: 'on_acceptance',
        release_date: null,
      },
    });
  } else if (url.endsWith('/retainer')) {
    request.flush({ data: RETAINER });
  } else {
    request.flush({ data: {} });
  }
}

async function render(contract: BillingContract | null = CONTRACT) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ProjectBillingComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'p1' })) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProjectBillingComponent);
  const http = TestBed.inject(HttpTestingController);
  const urls: string[] = [];

  fixture.detectChanges();

  for (let round = 0; round < 3; round++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    for (const request of http.match(() => true)) {
      urls.push(`${request.request.method} ${request.request.url}`);
      answer(request, contract);
    }

    fixture.detectChanges();
  }

  return { fixture, urls, element: fixture.nativeElement as HTMLElement };
}

describe('ProjectBillingComponent', () => {
  it('loads the contract, the unbilled summary, the certificates, the retention and the retainer', async () => {
    const { urls } = await render();

    expect(urls.some((url) => url.endsWith('/projects/p1/billing-contract'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/projects/p1/billing/unbilled-summary'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/projects/p1/sal-certificates'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/projects/p1/retention'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/projects/p1/retainer'))).toBe(true);
  });

  it('shows what is unbilled, the retention held and the latest WIP figure', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="billing-summary"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="sum-unbilled"]')?.textContent).toContain('240');
    expect(element.querySelector('[data-testid="sum-retention"]')?.textContent).toContain('1');
    expect(element.querySelector('[data-testid="sum-wip"]')).not.toBeNull();
  });

  it('shows the contract form with its status and the terms of the contract', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="contract-form"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="contract-status"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="contract-missing"]')).toBeNull();
  });

  it('offers to set the contract up when the project has none, and skips the dependent calls', async () => {
    const { element, urls } = await render(null);

    expect(element.querySelector('[data-testid="contract-missing"]')).not.toBeNull();
    expect(urls.some((url) => url.endsWith('/projects/p1/sal-certificates'))).toBe(false);
    expect(urls.some((url) => url.endsWith('/projects/p1/retainer'))).toBe(false);
  });

  it('does not call the retainer of a contract that does not prepay hours', async () => {
    const { urls } = await render({ ...CONTRACT, billing_model: 'fixed_milestone' });

    expect(urls.some((url) => url.endsWith('/projects/p1/retainer'))).toBe(false);
    expect(urls.some((url) => url.endsWith('/projects/p1/retention'))).toBe(true);
  });
});
