import {
  ArCreditLimit,
  ArCreditLimitPayload,
  ArCreditLimitUpdate,
  ArReactionPolicy,
} from '@core';
import { compareAmounts, parseAmount } from './receivables.util';

/** The credit limit form as typed by the user: every field is text, empty means "not set". */
export interface LimitDraft {
  currency: string;
  granted_limit: string;
  insured_limit: string;
  insurer_name: string;
  policy_number: string;
  coverage_percentage: string;
  max_overdue_days: string;
  overdue_tolerance_amount: string;
  reaction_policy: ArReactionPolicy;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  notes: string;
}

export type LimitField = keyof LimitDraft;

/** Translation key of the problem of a field. */
export type LimitErrors = Partial<Record<LimitField, string>>;

const MAX_OVERDUE_DAYS = 3650;

export function draftFromLimit(
  limit: ArCreditLimit | null,
  currency: string,
  today: string,
): LimitDraft {
  if (!limit) {
    return {
      currency,
      granted_limit: '',
      insured_limit: '',
      insurer_name: '',
      policy_number: '',
      coverage_percentage: '',
      max_overdue_days: '',
      overdue_tolerance_amount: '',
      reaction_policy: 'block_order',
      valid_from: today,
      valid_to: '',
      is_active: true,
      notes: '',
    };
  }
  return {
    currency: limit.currency,
    granted_limit: limit.granted_limit,
    insured_limit: limit.insured_limit,
    insurer_name: limit.insurer_name ?? '',
    policy_number: limit.policy_number ?? '',
    coverage_percentage: limit.coverage_percentage,
    max_overdue_days: limit.max_overdue_days === null ? '' : String(limit.max_overdue_days),
    overdue_tolerance_amount: limit.overdue_tolerance_amount,
    reaction_policy: limit.reaction_policy,
    valid_from: limit.valid_from,
    valid_to: limit.valid_to ?? '',
    is_active: limit.is_active,
    notes: limit.notes ?? '',
  };
}

function isNonNegativeAmount(value: string): boolean {
  const cents = parseAmount(value);
  return cents !== null && cents >= 0n;
}

/** Client side checks that mirror the rules of the API, so the common mistakes never leave the form. */
export function validateLimitDraft(draft: LimitDraft): LimitErrors {
  const errors: LimitErrors = {};

  if (!/^[A-Za-z]{3}$/.test(draft.currency.trim())) {
    errors.currency = 'AR.ERR_CURRENCY';
  }
  if (draft.granted_limit.trim() === '') {
    errors.granted_limit = 'AR.ERR_REQUIRED';
  } else if (!isNonNegativeAmount(draft.granted_limit.trim())) {
    errors.granted_limit = 'AR.ERR_AMOUNT';
  }
  for (const field of ['insured_limit', 'overdue_tolerance_amount'] as const) {
    const value = draft[field].trim();
    if (value !== '' && !isNonNegativeAmount(value)) {
      errors[field] = 'AR.ERR_AMOUNT';
    }
  }

  const coverage = draft.coverage_percentage.trim();
  if (coverage !== '') {
    const cents = parseAmount(coverage);
    if (cents === null || cents < 0n || cents > 10000n) {
      errors.coverage_percentage = 'AR.ERR_PERCENT';
    }
  }

  const days = draft.max_overdue_days.trim();
  if (days !== '' && !(/^\d+$/.test(days) && Number(days) <= MAX_OVERDUE_DAYS)) {
    errors.max_overdue_days = 'AR.ERR_DAYS';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.valid_from)) {
    errors.valid_from = 'AR.ERR_REQUIRED';
  }
  if (draft.valid_to !== '' && draft.valid_from !== '' && draft.valid_to < draft.valid_from) {
    errors.valid_to = 'AR.ERR_PERIOD';
  }

  // An insured limit needs the insurer or the policy number.
  const insured = draft.insured_limit.trim();
  if (
    insured !== '' &&
    compareAmounts(insured, '0.00') > 0 &&
    draft.insurer_name.trim() === '' &&
    draft.policy_number.trim() === ''
  ) {
    errors.insurer_name = 'AR.ERR_INSURANCE';
  }

  return errors;
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

function fields(draft: LimitDraft): ArCreditLimitUpdate {
  return {
    currency: draft.currency.trim().toUpperCase(),
    granted_limit: draft.granted_limit.trim(),
    insured_limit: orNull(draft.insured_limit),
    insurer_name: orNull(draft.insurer_name),
    policy_number: orNull(draft.policy_number),
    coverage_percentage: orNull(draft.coverage_percentage),
    max_overdue_days: draft.max_overdue_days.trim() === '' ? null : Number(draft.max_overdue_days),
    overdue_tolerance_amount: orNull(draft.overdue_tolerance_amount),
    reaction_policy: draft.reaction_policy,
    valid_from: draft.valid_from,
    valid_to: orNull(draft.valid_to),
    is_active: draft.is_active,
    notes: orNull(draft.notes),
  };
}

export function limitPayload(draft: LimitDraft, customerId: string): ArCreditLimitPayload {
  return { ...(fields(draft) as Omit<ArCreditLimitPayload, 'customer_id'>), customer_id: customerId };
}

export function limitUpdate(draft: LimitDraft): ArCreditLimitUpdate {
  return fields(draft);
}
