import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvWelfareRedemption } from '@core';
import { baseProviders, lookups, page, wrap } from './corporate-conventions.testing';
import { BillingReconciliationComponent } from './billing-reconciliation.component';

function voucher(id: string, extra: Partial<CcvWelfareRedemption> = {}): CcvWelfareRedemption {
  return {
    id,
    source_document_type: 'POS_RECEIPT',
    source_document_id: 'doc-1',
    enrollment_id: null,
    jurisdiction: 'IT_ART51_TUIR',
    provider: 'EDENRED',
    welfare_category: 'MEAL_VOUCHER',
    voucher_code_masked: '****1234',
    currency: 'EUR',
    gross_voucher_amount: '10.00',
    merchant_fee_percentage: '8.0000',
    merchant_fee_amount: '0.80',
    net_expected_reimbursement: '9.20',
    reimbursement_status: 'PENDING_SETTLEMENT',
    settlement_batch_reference: null,
    provider_self_invoice_number: null,
    settled_amount: null,
    reconciled_at: null,
    created_at: '2028-02-05T10:00:00Z',
    ...extra,
  };
}

interface Internals {
  statement: { set: (value: string) => void };
  parsedStatement: () => { lines: unknown[]; invalid: number[] };
  canReconcile: () => boolean;
  settlementProvider: { set: (value: string) => void };
  batchReference: { set: (value: string) => void };
  selected: () => string[];
  toggle: (voucher: CcvWelfareRedemption) => void;
}

describe('BillingReconciliationComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getPendingQuotas: vi.fn(() =>
        of(
          wrap([
            {
              convention_id: 'c-1',
              convention_name: 'Acme',
              partner_company_name: 'Acme Srl',
              billing_cycle: 'MONTHLY',
              currency: 'EUR',
              rows_count: 3,
              total_employer_quota: '60.00',
              oldest_transaction_date: '2028-02-01',
              newest_transaction_date: '2028-02-20',
            },
          ]),
        ),
      ),
      listWelfareVouchers: vi.fn(() =>
        of(
          page([
            voucher('v1'),
            voucher('v2', {
              reimbursement_status: 'RECONCILED',
              settlement_batch_reference: 'B-1',
            }),
          ]),
        ),
      ),
      getWelfareSummary: vi.fn(() =>
        of(
          wrap([
            {
              provider: 'EDENRED',
              reimbursement_status: 'PENDING_SETTLEMENT',
              currency: 'EUR',
              vouchers: 1,
              gross: '10.00',
              fee: '0.80',
              net: '9.20',
            },
          ]),
        ),
      ),
      previewConsolidation: vi.fn(() =>
        of(
          wrap({
            convention_id: 'c-1',
            convention_name: 'Acme',
            partner_company_name: 'Acme Srl',
            currency: 'EUR',
            period_from: '2028-02-01',
            period_to: '2028-02-29',
            anonymized: true,
            rows_count: 1,
            total_employer_quota: '20.00',
            schedule: [
              {
                date: '2028-02-03',
                beneficiary: 'B-1A2B3C4D',
                document: 'doc-1',
                gross: '100.00',
                discount: '15.00',
                employer_quota: '20.00',
                employee_paid: '65.00',
              },
            ],
          }),
        ),
      ),
      generateInvoice: vi.fn(() =>
        of(
          wrap({
            invoice_id: 'inv-1',
            invoice_number: 'F-1',
            total_gross: '24.40',
            rows_count: 1,
            total_employer_quota: '20.00',
            attachment_url: '/x',
          }),
        ),
      ),
      submitVoucherBatch: vi.fn(() => of(wrap({ submitted: 1, batch_reference: 'B-2' }))),
      reconcileVouchers: vi.fn(() =>
        of(
          wrap({
            reconciled: 1,
            rejected: 0,
            total_expected: '9.20',
            total_settled: '9.20',
            discrepancies: [],
          }),
        ),
      ),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api, () => canWrite) });
  });

  async function render() {
    const fixture = TestBed.createComponent(BillingReconciliationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the pending employer quotas by convention with their total and period', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const rows = Array.from(root.querySelectorAll('tbody tr.ant-table-row'));

    expect(api['getPendingQuotas']).toHaveBeenCalled();
    const first = rows.find((row) => (row.textContent ?? '').includes('Acme Srl'));
    expect(first).toBeDefined();
    expect(first?.textContent).toContain('corporateConventions.billingCycle.MONTHLY');
    expect(first?.textContent).toContain('2028-02-01');
    expect(first?.textContent).toContain('2028-02-20');
  });

  it('previews the anonymized beneficiary schedule and lets finance generate the invoice in one click', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const preview = Array.from(root.querySelectorAll('button')).find((button) =>
      (button.textContent ?? '').includes('corporateConventions.action.preview'),
    );
    (preview as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['previewConsolidation']).toHaveBeenCalledWith(
      expect.objectContaining({ convention_id: 'c-1', anonymize: null }),
    );
    expect(root.textContent).toContain('B-1A2B3C4D');
    expect(root.textContent).toContain('corporateConventions.label.scheduleAnonymized');
    expect(root.textContent).toContain('corporateConventions.action.generateInvoice');
  });

  it('hides the invoice and the settlement actions from a member who is not finance', async () => {
    canWrite = false;
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const preview = Array.from(root.querySelectorAll('button')).find((button) =>
      (button.textContent ?? '').includes('corporateConventions.action.preview'),
    );
    (preview as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).not.toContain('corporateConventions.action.generateInvoice');
    expect(root.textContent).not.toContain('corporateConventions.section.settlement');
  });

  it('shows the vouchers with gross, merchant fee and net receivable, and the summary by provider', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(api['listWelfareVouchers']).toHaveBeenCalledWith({ per_page: 25, page: 1 });
    expect(api['getWelfareSummary']).toHaveBeenCalled();
    const text = root.textContent ?? '';
    expect(text).toContain('corporateConventions.provider.EDENRED');
    expect(text).toContain('****1234');
    expect(text).toContain('corporateConventions.reimbursement.PENDING_SETTLEMENT');
    expect(text).toContain('corporateConventions.reimbursement.RECONCILED');
    expect(text).toContain('8.0000');
  });

  it('only a pending voucher can be selected, and the statement is parsed before reconciling', async () => {
    const fixture = await render();
    const internals = fixture.componentInstance as unknown as Internals;
    const root = fixture.nativeElement as HTMLElement;
    const boxes = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

    expect(boxes).toHaveLength(2);
    expect(boxes[0].disabled).toBe(false);
    expect(boxes[1].disabled).toBe(true);

    internals.toggle(voucher('v1'));
    expect(internals.selected()).toEqual(['v1']);

    internals.statement.set('ABC1234;9.20\nbroken line');
    expect(internals.parsedStatement().invalid).toEqual([2]);
    internals.batchReference.set('B-2');
    expect(internals.canReconcile()).toBe(false);

    internals.statement.set('ABC1234;9.20');
    expect(internals.parsedStatement().lines).toEqual([
      { voucher_code: 'ABC1234', settled_amount: 9.2 },
    ]);
    expect(internals.canReconcile()).toBe(true);
  });
});
