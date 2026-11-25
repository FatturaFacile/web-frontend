import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvPendingQuota, CcvWelfareRedemption, CorporateConventionsApiService } from '@core';
import { lookups, page, wrap } from './corporate-conventions.testing';
import { ReconciliationStore } from './reconciliation.store';

const pending: CcvPendingQuota[] = [
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
  {
    convention_id: 'c-2',
    convention_name: 'Beta',
    partner_company_name: 'Beta SA',
    billing_cycle: 'QUARTERLY',
    currency: 'EUR',
    rows_count: 1,
    total_employer_quota: '15.50',
    oldest_transaction_date: '2028-02-03',
    newest_transaction_date: '2028-02-03',
  },
];

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

describe('ReconciliationStore', () => {
  const api = {
    getLookups: vi.fn(),
    getPendingQuotas: vi.fn(),
    listWelfareVouchers: vi.fn(),
    getWelfareSummary: vi.fn(),
    previewConsolidation: vi.fn(),
    generateInvoice: vi.fn(),
    downloadSchedule: vi.fn(),
    submitVoucherBatch: vi.fn(),
    reconcileVouchers: vi.fn(),
  };
  let store: InstanceType<typeof ReconciliationStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(of(wrap(lookups)));
    api.getPendingQuotas.mockReturnValue(of(wrap(pending)));
    api.listWelfareVouchers.mockReturnValue(
      of(page([voucher('v1'), voucher('v2', { reimbursement_status: 'RECONCILED' })])),
    );
    api.getWelfareSummary.mockReturnValue(
      of(
        wrap([
          {
            provider: 'EDENRED',
            reimbursement_status: 'PENDING_SETTLEMENT',
            currency: 'EUR',
            vouchers: 2,
            gross: '20.00',
            fee: '1.60',
            net: '18.40',
          },
          {
            provider: 'EDENRED',
            reimbursement_status: 'SUBMITTED_TO_PROVIDER',
            currency: 'EUR',
            vouchers: 1,
            gross: '10.00',
            fee: '0.80',
            net: '9.20',
          },
          {
            provider: 'REKA_CARD',
            reimbursement_status: 'RECONCILED',
            currency: 'CHF',
            vouchers: 4,
            gross: '40.00',
            fee: '0.60',
            net: '39.40',
          },
        ]),
      ),
    );
    TestBed.configureTestingModule({
      providers: [ReconciliationStore, { provide: CorporateConventionsApiService, useValue: api }],
    });
    store = TestBed.inject(ReconciliationStore);
  });

  it('loads the pending quotas, the vouchers and the summary, and totals what is open', async () => {
    await store.init();

    expect(store.pending()).toHaveLength(2);
    expect(store.pendingTotal()).toBe(75.5);
    expect(store.vouchers()).toHaveLength(2);
    expect(store.openVouchers().map((v) => v.id)).toEqual(['v1']);
    expect(Object.keys(store.openReceivable())).toEqual(['EUR']);
    expect(store.openReceivable()['EUR']).toBeCloseTo(27.6, 2);
    expect(store.loading()).toBe(false);
  });

  it('keeps a schedule preview until the invoice is generated and then reloads the pending quotas', async () => {
    api.previewConsolidation.mockReturnValue(
      of(
        wrap({
          convention_id: 'c-1',
          convention_name: 'Acme',
          partner_company_name: 'Acme Srl',
          currency: 'EUR',
          period_from: '2028-02-01',
          period_to: '2028-02-29',
          anonymized: true,
          rows_count: 3,
          total_employer_quota: '60.00',
          schedule: [],
        }),
      ),
    );
    api.generateInvoice.mockReturnValue(
      of(
        wrap({
          invoice_id: 'inv-1',
          invoice_number: 'F-1',
          total_gross: '73.20',
          rows_count: 3,
          total_employer_quota: '60.00',
          attachment_url: '/x',
        }),
      ),
    );
    await store.init();

    await store.previewConsolidation({ convention_id: 'c-1', period: '2028-02' });
    expect(store.preview()?.anonymized).toBe(true);

    const outcome = await store.generateInvoice({ convention_id: 'c-1', period: '2028-02' });

    expect(outcome.ok).toBe(true);
    expect(store.preview()).toBeNull();
    expect(store.lastInvoice()?.invoice_number).toBe('F-1');
    expect(api.getPendingQuotas).toHaveBeenCalledTimes(2);
  });

  it('reports a refused invoice, e.g. nothing to bill', async () => {
    api.generateInvoice.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 422, error: { code: 'consolidation_nothing_to_bill' } }),
      ),
    );

    const refused = await store.generateInvoice({ convention_id: 'c-1', period: '2028-02' });

    expect(refused.ok).toBe(false);
    expect(refused.errorKey).toBe('corporateConventions.error.consolidation_nothing_to_bill');
    expect(store.working()).toBe(false);
  });

  it('filters the vouchers from the first page', async () => {
    await store.init();
    await store.setVoucherPage(2);
    await store.setVoucherFilters({ provider: 'EDENRED', status: 'PENDING_SETTLEMENT' });

    expect(api.listWelfareVouchers).toHaveBeenLastCalledWith({
      per_page: 25,
      page: 1,
      provider: 'EDENRED',
      status: 'PENDING_SETTLEMENT',
    });
  });

  it('submits a batch and reconciles against the statement, keeping the discrepancies', async () => {
    api.submitVoucherBatch.mockReturnValue(of(wrap({ submitted: 1, batch_reference: 'B-1' })));
    api.reconcileVouchers.mockReturnValue(
      of(
        wrap({
          reconciled: 1,
          rejected: 1,
          total_expected: '18.40',
          total_settled: '18.00',
          discrepancies: [
            {
              redemption_id: 'v1',
              voucher_code_masked: '****1234',
              expected: '9.20',
              settled: '8.80',
              difference: '-0.40',
            },
          ],
        }),
      ),
    );
    await store.init();

    expect((await store.submitBatch('EDENRED', 'B-1', ['v1'])).ok).toBe(true);
    expect(api.submitVoucherBatch).toHaveBeenCalledWith('EDENRED', 'B-1', ['v1']);

    const outcome = await store.reconcile({
      provider: 'EDENRED',
      batch_reference: 'B-1',
      lines: [{ voucher_code: 'X', settled_amount: 9.2 }],
    });

    expect(outcome.ok).toBe(true);
    expect(store.lastReconciliation()?.rejected).toBe(1);
    expect(store.lastReconciliation()?.discrepancies[0].difference).toBe('-0.40');
    expect(api.listWelfareVouchers).toHaveBeenCalledTimes(3);
  });
});
