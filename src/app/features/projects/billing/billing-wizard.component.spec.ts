import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BillingWizardComponent } from './billing-wizard.component';
import { BillingContract } from './project-billing.models';

const CONTRACT: BillingContract = {
  id: 'c1',
  project_id: 'p1',
  customer_id: 'k1',
  billing_model: 'sal_progress',
  fiscal_jurisdiction: 'IT',
  currency_code: 'EUR',
  contract_total_value: '100000.0000',
  advance_payment_percent: '10.0000',
  advance_payment_amount: '0.0000',
  advance_recouped_amount: '0.0000',
  retention_guarantee_percent: '5.0000',
  retention_release_rule: 'manual',
  retention_release_date: null,
  cap_amount: null,
  markup_percent: '0.0000',
  rate_card_id: null,
  prepaid_hours_allowance: '0.0000',
  prepaid_amount_allowance: '0.0000',
  low_balance_alert_threshold_percent: '10.0000',
  low_balance_alerted_at: null,
  cig: null,
  cup: null,
  contract_reference: null,
  contract_date: null,
  billing_status: 'active',
  version: 1,
};

async function render(contract: BillingContract | null) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [BillingWizardComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();

  const fixture = TestBed.createComponent(BillingWizardComponent);
  const ref = fixture.componentRef as ComponentRef<BillingWizardComponent>;
  const http = TestBed.inject(HttpTestingController);

  ref.setInput('projectId', 'p1');
  ref.setInput('contract', contract);
  fixture.detectChanges();
  http
    .match((request) => request.url.includes('/translations/'))
    .forEach((request) => request.flush({ translations: {} }));

  return { fixture, ref, http, element: fixture.nativeElement as HTMLElement };
}

/** The percentage field is a signal of the component: setting it is what typing in the number input does. */
function setPercent(fixture: { componentInstance: unknown }, value: number): void {
  (fixture.componentInstance as { percent: { set(next: number): void } }).percent.set(value);
}

describe('BillingWizardComponent', () => {
  it('asks to activate the contract before billing', async () => {
    const { element } = await render({ ...CONTRACT, billing_status: 'draft' });

    expect(element.querySelector('[data-testid="wizard-inactive"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="wizard-family"]')).toBeNull();
  });

  it('offers only the billing families of the model of the contract', async () => {
    const { element } = await render(CONTRACT);

    expect(element.querySelector('[data-testid="family-progress"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="family-tm"]')).toBeNull();
    expect(element.querySelector('[data-testid="family-milestones"]')).toBeNull();
  });

  it('offers every family under a hybrid contract', async () => {
    const { element } = await render({ ...CONTRACT, billing_model: 'hybrid' });

    expect(element.querySelector('[data-testid="family-progress"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="family-tm"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="family-milestones"]')).not.toBeNull();
  });

  it('previews the SAL with the advance deduction, the retention and the net, then drafts it', async () => {
    const { fixture, http, element } = await render(CONTRACT);

    (element.querySelector('[data-testid="family-progress"] input') as HTMLInputElement).click();
    fixture.detectChanges();
    (element.querySelector('[data-testid="wizard-next"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="sal-invalid"]')).not.toBeNull();
    expect(
      (element.querySelector('[data-testid="wizard-confirm"]') as HTMLButtonElement).disabled,
    ).toBe(true);

    setPercent(fixture, 30);
    fixture.detectChanges();

    const preview = element.querySelector('[data-testid="sal-preview"]');

    expect(preview).not.toBeNull();
    expect(element.querySelector('[data-testid="sal-net"]')?.textContent).toMatch(/25[.,’' ]?500/);

    (element.querySelector('[data-testid="wizard-confirm"]') as HTMLButtonElement).click();
    const request = http.expectOne((candidate) =>
      candidate.url.endsWith('/projects/p1/sal-certificates'),
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body.cumulative_completion_percent).toBe(30);
    request.flush({ data: { id: 's1', sal_number: 1 } });
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="wizard-done"]')).not.toBeNull();
  });
});
