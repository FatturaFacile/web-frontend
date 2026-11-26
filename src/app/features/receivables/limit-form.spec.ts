import { describe, expect, it } from 'vitest';
import { draftFromLimit, limitPayload, limitUpdate, validateLimitDraft } from './limit-form';
import { limit } from './receivables.fixtures';

const today = '2026-03-31';

describe('credit limit form', () => {
  it('starts a new limit valid from today, active, blocking the orders', () => {
    const draft = draftFromLimit(null, 'EUR', today);

    expect(draft).toMatchObject({
      currency: 'EUR',
      granted_limit: '',
      reaction_policy: 'block_order',
      valid_from: today,
      valid_to: '',
      is_active: true,
    });
  });

  it('fills the form from an existing limit', () => {
    const draft = draftFromLimit(
      limit({ valid_to: '2026-12-31', notes: 'Review in autumn' }),
      'CHF',
      today,
    );

    expect(draft.currency).toBe('EUR');
    expect(draft.granted_limit).toBe('2000.00');
    expect(draft.insurer_name).toBe('Allianz Trade');
    expect(draft.max_overdue_days).toBe('30');
    expect(draft.valid_to).toBe('2026-12-31');
    expect(draft.notes).toBe('Review in autumn');
  });

  it('accepts a complete valid draft', () => {
    const draft = { ...draftFromLimit(limit(), 'EUR', today) };

    expect(validateLimitDraft(draft)).toEqual({});
  });

  it('requires the granted limit, the currency and the start of the validity', () => {
    const errors = validateLimitDraft({
      ...draftFromLimit(null, 'EUR', today),
      currency: 'EU',
      valid_from: '',
    });

    expect(errors).toEqual({
      currency: 'AR.ERR_CURRENCY',
      granted_limit: 'AR.ERR_REQUIRED',
      valid_from: 'AR.ERR_REQUIRED',
    });
  });

  it('rejects amounts that are not plain non-negative decimals', () => {
    const draft = {
      ...draftFromLimit(limit(), 'EUR', today),
      granted_limit: '1.234',
      insured_limit: '-5',
      overdue_tolerance_amount: 'abc',
    };

    expect(validateLimitDraft(draft)).toMatchObject({
      granted_limit: 'AR.ERR_AMOUNT',
      insured_limit: 'AR.ERR_AMOUNT',
      overdue_tolerance_amount: 'AR.ERR_AMOUNT',
    });
  });

  it('keeps the coverage between 0 and 100 and the overdue days a whole number up to 3650', () => {
    const base = draftFromLimit(limit(), 'EUR', today);

    expect(validateLimitDraft({ ...base, coverage_percentage: '100.01' }).coverage_percentage).toBe(
      'AR.ERR_PERCENT',
    );
    expect(
      validateLimitDraft({ ...base, coverage_percentage: '100' }).coverage_percentage,
    ).toBeUndefined();
    expect(validateLimitDraft({ ...base, max_overdue_days: '3651' }).max_overdue_days).toBe(
      'AR.ERR_DAYS',
    );
    expect(validateLimitDraft({ ...base, max_overdue_days: '1.5' }).max_overdue_days).toBe(
      'AR.ERR_DAYS',
    );
    expect(validateLimitDraft({ ...base, max_overdue_days: '' }).max_overdue_days).toBeUndefined();
  });

  it('refuses an end of validity before its start', () => {
    const base = draftFromLimit(limit(), 'EUR', today);

    expect(
      validateLimitDraft({ ...base, valid_from: '2026-04-01', valid_to: '2026-03-01' }).valid_to,
    ).toBe('AR.ERR_PERIOD');
    expect(
      validateLimitDraft({ ...base, valid_from: '2026-04-01', valid_to: '2026-04-01' }).valid_to,
    ).toBeUndefined();
  });

  it('wants the insurer or the policy number for an insured limit', () => {
    const base = { ...draftFromLimit(limit(), 'EUR', today), insurer_name: '', policy_number: '' };

    expect(validateLimitDraft(base).insurer_name).toBe('AR.ERR_INSURANCE');
    expect(validateLimitDraft({ ...base, policy_number: 'POL-9' }).insurer_name).toBeUndefined();
    expect(validateLimitDraft({ ...base, insured_limit: '0.00' }).insurer_name).toBeUndefined();
  });

  it('builds the create payload with empty optionals as null and the currency in capitals', () => {
    const draft = {
      ...draftFromLimit(null, 'eur', today),
      granted_limit: ' 5000.00 ',
      reaction_policy: 'credit_hold' as const,
      max_overdue_days: '45',
    };

    expect(limitPayload(draft, 'c-1')).toEqual({
      customer_id: 'c-1',
      currency: 'EUR',
      granted_limit: '5000.00',
      insured_limit: null,
      insurer_name: null,
      policy_number: null,
      coverage_percentage: null,
      max_overdue_days: 45,
      overdue_tolerance_amount: null,
      reaction_policy: 'credit_hold',
      valid_from: today,
      valid_to: null,
      is_active: true,
      notes: null,
    });
  });

  it('builds an update that carries no customer', () => {
    const update = limitUpdate(draftFromLimit(limit(), 'EUR', today));

    expect('customer_id' in update).toBe(false);
    expect(update.granted_limit).toBe('2000.00');
    expect(update.max_overdue_days).toBe(30);
  });
});
