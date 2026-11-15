import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../testing/component-smoke';
import { InvoiceApprovalsComponent } from './billing/approvals/invoice-approvals.component';
import { DebitNoteComponent } from './billing/debit-note/debit-note.component';
import { DeferredBillingComponent } from './billing/deferred/deferred-billing.component';
import { BillingPlansComponent } from './billing/plans/billing-plans.component';
import { BillingReportsComponent } from './billing/reports/billing-reports.component';
import { CycleDeliveryNotesComponent } from './cycle/delivery-notes/delivery-notes.component';
import { DiscountPoliciesComponent } from './cycle/pricing/discount-policies.component';
import { CycleReturnsComponent } from './cycle/returns/returns.component';

describe('Sales pages boot against an empty backend', () => {
  const pages = [
    ['invoice approvals', InvoiceApprovalsComponent],
    ['debit notes', DebitNoteComponent],
    ['deferred billing', DeferredBillingComponent],
    ['billing plans', BillingPlansComponent],
    ['billing reports', BillingReportsComponent],
    ['delivery notes', CycleDeliveryNotesComponent],
    ['discount policies', DiscountPoliciesComponent],
    ['returns', CycleReturnsComponent],
  ] as const;

  it.each(pages)('%s', async (_name, component) => {
    const { fixture } = await renderPageWithEmptyBackend(component);

    expect(fixture.nativeElement).toBeTruthy();
  });
});
