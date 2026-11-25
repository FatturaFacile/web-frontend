import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvCartLine, CcvPricing, CorporateConventionsApiService } from '@core';
import { enrollment, lookups, wrap } from './corporate-conventions.testing';
import { PosConventionStore } from './pos-convention.store';

const lines: CcvCartLine[] = [{ line_id: '1', quantity: 2, unit_price: 100 }];

const pricing: CcvPricing = {
  enrollment: enrollment('e-1'),
  lines: [
    {
      line_id: '1',
      gross: '200.00',
      existing_discount: '0.00',
      convention_discount: '30.00',
      net: '170.00',
      cost: '80.00',
      applied_rule_ids: ['r-1'],
    },
  ],
  totals: {
    total_gross_amount: '200.00',
    convention_discount_amount: '30.00',
    payable_after_discount: '170.00',
    employer_subsidy_amount: '34.00',
    employee_paid_amount: '136.00',
    cost_amount: '80.00',
  },
  cap: { remaining_before: '750.00', counted_spend: '170.00', reached: false },
  subsidy: { remaining_before: '180.00' },
};

describe('PosConventionStore', () => {
  const api = {
    getLookups: vi.fn(),
    verifyIdentifier: vi.fn(),
    priceCart: vi.fn(),
    checkout: vi.fn(),
    redeemVoucher: vi.fn(),
  };
  let store: InstanceType<typeof PosConventionStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(of(wrap(lookups)));
    api.verifyIdentifier.mockReturnValue(of(wrap(enrollment('e-1'))));
    api.priceCart.mockReturnValue(of(wrap(pricing)));
    TestBed.configureTestingModule({
      providers: [PosConventionStore, { provide: CorporateConventionsApiService, useValue: api }],
    });
    store = TestBed.inject(PosConventionStore);
  });

  it('reads a pass and shows the customer with what is left of the caps', async () => {
    await store.init();

    const outcome = await store.verify('FFCONV:0192f0f0-0000-7000-8000-000000000001');

    expect(outcome.ok).toBe(true);
    expect(store.enrollment()?.full_name).toBe('Mario Rossi');
    expect(store.enrollment()?.annual_cap_remaining).toBe('750.00');
    expect(api.verifyIdentifier).toHaveBeenCalledWith({
      identifier: 'FFCONV:0192f0f0-0000-7000-8000-000000000001',
      convention_id: null,
    });
  });

  it('refuses an unknown pass with its key and shows no customer', async () => {
    api.verifyIdentifier.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { code: 'enrollment_not_found' } }),
      ),
    );

    const outcome = await store.verify('nobody');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('corporateConventions.error.enrollment_not_found');
    expect(store.enrollment()).toBeNull();
    expect(store.verifying()).toBe(false);
  });

  it('prices the cart under the pass: discount, employer quota and what the employee pays', async () => {
    await store.verify('card');

    await store.price(lines, 'EUR');

    expect(api.priceCart).toHaveBeenCalledWith({
      identifier: 'FFCONV:0192f0f0-0000-7000-8000-000000000001',
      convention_id: 'c-1',
      currency: 'EUR',
      lines,
    });
    expect(store.totals()?.employee_paid_amount).toBe('136.00');
    expect(store.capRemaining()).toBe('750.00');
    expect(store.capReached()).toBe(false);
  });

  it('does not price an empty cart or without a pass', async () => {
    await store.price(lines, 'EUR');
    await store.verify('card');
    await store.price([], 'EUR');

    expect(api.priceCart).not.toHaveBeenCalled();
    expect(store.pricing()).toBeNull();
  });

  it('commits the sale and keeps the split billing it recorded', async () => {
    api.checkout.mockReturnValue(
      of(
        wrap({
          ...pricing,
          split_billing: { id: 'sb-1', billing_status: 'PENDING_CONSOLIDATION' },
        }),
      ),
    );
    await store.verify('card');

    const outcome = await store.commit(lines, 'POS_RECEIPT', 'doc-1', 'EUR');

    expect(outcome.ok).toBe(true);
    expect(api.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollment_id: 'e-1',
        source_document_type: 'POS_RECEIPT',
        source_document_id: 'doc-1',
        currency: 'EUR',
      }),
    );
    expect(store.checkout()?.split_billing.id).toBe('sb-1');
  });

  it('refuses to commit without a pass and reports a document that was already applied', async () => {
    expect((await store.commit(lines, 'POS_RECEIPT', 'doc-1', 'EUR')).code).toBe(
      'enrollment_not_found',
    );

    api.checkout.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'checkout_already_applied' } }),
      ),
    );
    await store.verify('card');
    const refused = await store.commit(lines, 'POS_RECEIPT', 'doc-1', 'EUR');

    expect(refused.errorKey).toBe('corporateConventions.error.checkout_already_applied');
    expect(store.committing()).toBe(false);
  });

  it('picks the welfare providers of the jurisdiction of the currency and totals the vouchers paid', async () => {
    await store.init();
    expect(store.jurisdictionFor('CHF')).toBe('CH_REKA_LUNCHCHECK');
    expect(
      store.providersFor(store.jurisdictionFor('CHF')).map((option) => option.provider),
    ).toEqual(['LUNCH_CHECK', 'REKA_CARD']);
    expect(store.providersFor(store.jurisdictionFor('EUR'))[0].default_fee_percentage).toBe('8.00');

    api.redeemVoucher.mockReturnValue(
      of(wrap({ id: 'w-1', gross_voucher_amount: '10.00', provider: 'EDENRED' })),
    );
    const outcome = await store.redeem({
      source_document_type: 'POS_RECEIPT',
      source_document_id: 'doc-1',
      jurisdiction: 'IT_ART51_TUIR',
      provider: 'EDENRED',
      welfare_category: 'MEAL_VOUCHER',
      voucher_code: 'ABCD1234',
      currency: 'EUR',
      gross_voucher_amount: 10,
    });

    expect(outcome.ok).toBe(true);
    expect(store.redemptions()).toHaveLength(1);
    expect(store.paidByVouchers()).toBe(10);
  });

  it('reports a voucher the provider is not allowed to pay with and keeps the list unchanged', async () => {
    api.redeemVoucher.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'welfare_category_not_allowed',
              params: { category: 'HEALTHCARE', provider: 'LUNCH_CHECK' },
            },
          }),
      ),
    );

    const refused = await store.redeem({
      source_document_type: 'POS_RECEIPT',
      source_document_id: 'doc-1',
      jurisdiction: 'CH_REKA_LUNCHCHECK',
      provider: 'LUNCH_CHECK',
      welfare_category: 'HEALTHCARE',
      voucher_code: 'ABCD1234',
      currency: 'CHF',
      gross_voucher_amount: 10,
    });

    expect(refused.errorKey).toBe('corporateConventions.error.welfare_category_not_allowed');
    expect(refused.params).toEqual({ category: 'HEALTHCARE', provider: 'LUNCH_CHECK' });
    expect(store.redemptions()).toEqual([]);
    expect(store.redeeming()).toBe(false);
  });

  it('forgets the customer, the pricing and the vouchers on reset', async () => {
    await store.verify('card');
    await store.price(lines, 'EUR');

    store.reset();

    expect(store.enrollment()).toBeNull();
    expect(store.pricing()).toBeNull();
    expect(store.redemptions()).toEqual([]);
  });
});
