import { HttpErrorResponse } from '@angular/common/http';
import {
  CcvConvention,
  CcvConventionPayload,
  CcvConventionStatus,
  CcvDiscountRule,
  CcvEnrollmentStatus,
  CcvLookups,
  CcvProblem,
  CcvReimbursementStatus,
  CcvSplitBillingStatus,
  CcvWelfareJurisdiction,
  CcvWelfareProviderOption,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance and sales roles write. */
export const CORPORATE_CONVENTIONS_MODULE = 'corporate_conventions';

/** Module key of the finance ability: invoicing the employer quota and settling welfare vouchers. */
export const CORPORATE_CONVENTIONS_FINANCE_MODULE = 'corporate_conventions_finance';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and the field errors of a 422. */
export interface CcvOutcome {
  ok: boolean;
  /** Translation key of the refusal (`corporateConventions.error.<code>`), null on success. */
  errorKey: string | null;
  /** The code of the problem, so a screen can react to a specific refusal. */
  code: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  /** The parameters the API sent with the problem, scalars only (the texts of the dictionary use them). */
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const CCV_OK: CcvOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
};

export function errorKey(code: string | null | undefined): string {
  return `corporateConventions.error.${code ? code : 'generic'}`;
}

export function problemOf(error: unknown): CcvProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as CcvProblem) : null;
}

function scalarParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): CcvOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    code: problem?.code ?? null,
    detail: first ?? problem?.detail ?? null,
    params: scalarParams(problem?.params),
    errors,
  };
}

// --- Colours ---

const CONVENTION_COLORS: Record<CcvConventionStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'green',
  SUSPENDED: 'orange',
  EXPIRED: 'red',
};

export function conventionStatusColor(status: CcvConventionStatus): string {
  return CONVENTION_COLORS[status] ?? 'default';
}

const ENROLLMENT_COLORS: Record<CcvEnrollmentStatus, string> = {
  PENDING_OTP: 'gold',
  ACTIVE: 'green',
  REVOKED: 'red',
  EXPIRED: 'default',
};

export function enrollmentStatusColor(status: CcvEnrollmentStatus): string {
  return ENROLLMENT_COLORS[status] ?? 'default';
}

const SPLIT_COLORS: Record<CcvSplitBillingStatus, string> = {
  PENDING_CONSOLIDATION: 'gold',
  INVOICED: 'blue',
  PAID: 'green',
  DISPUTED: 'red',
};

export function splitBillingStatusColor(status: CcvSplitBillingStatus): string {
  return SPLIT_COLORS[status] ?? 'default';
}

const REIMBURSEMENT_COLORS: Record<CcvReimbursementStatus, string> = {
  PENDING_SETTLEMENT: 'gold',
  SUBMITTED_TO_PROVIDER: 'blue',
  RECONCILED: 'green',
  REJECTED: 'red',
};

export function reimbursementStatusColor(status: CcvReimbursementStatus): string {
  return REIMBURSEMENT_COLORS[status] ?? 'default';
}

// --- Decimal helpers (display only: the API computes every amount) ---

/** A decimal string or number as a number for a chart or a progress bar, never for money arithmetic. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Share of `part` in `whole`, in percent, bounded to 0-100 (for the bars of the dashboard). */
export function shareOf(part: string | number, whole: string | number): number {
  const total = toNumber(whole);
  return total <= 0 ? 0 : Math.max(0, Math.min(100, (toNumber(part) / total) * 100));
}

export function toDateString(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `YYYY-MM` of the month before `reference` (the month a consolidation usually invoices). */
export function previousMonth(reference: Date = new Date()): string {
  const date = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

// --- Employer list (SHA-256) ---

const HEADER_NAMES = [
  'IDENTIFIER',
  'MATRICOLA',
  'BADGE',
  'CARD',
  'CODICE',
  'ID',
  'PERSONALNUMMER',
  'MATRICULE',
];

/** Same normalisation as the server: trimmed, no inner whitespace, upper case. */
export function normalizeIdentifier(identifier: string): string {
  return identifier.replace(/\s+/gu, '').toUpperCase();
}

/** SHA-256 of the normalised identifier, hex encoded: what the server stores (the preview shows it before the upload). */
export async function sha256Hex(identifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeIdentifier(identifier));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** "***123": the part of an identifier that is shown instead of the identifier. */
export function identifierHint(identifier: string, visible = 3): string {
  const normalized = normalizeIdentifier(identifier);
  return normalized.length <= visible
    ? '*'.repeat(normalized.length)
    : `***${normalized.slice(-visible)}`;
}

/**
 * The identifiers of a pasted list or a CSV (first column): one per line, comma or semicolon, without the header row and without
 * duplicates.
 */
export function parseIdentifiers(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const rows = text.split(/\r\n|\r|\n/u);
  rows.forEach((row, index) => {
    const cell = (row.split(/[,;\t]/u)[0] ?? '').trim().replace(/^"|"$/gu, '');
    if (cell === '' || (index === 0 && HEADER_NAMES.includes(cell.toUpperCase()))) {
      return;
    }
    const key = normalizeIdentifier(cell);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cell);
    }
  });
  return result;
}

// --- Eligibility ---

/** "@partner.it" from "Partner.IT" or "@partner.it": the form the API stores and shows. */
export function normalizeDomain(input: string): string {
  const domain = input.trim().toLowerCase().replace(/^@+/u, '');
  return domain === '' ? '' : `@${domain}`;
}

export function isValidDomain(input: string): boolean {
  return /^@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/u.test(
    normalizeDomain(input),
  );
}

/** Whether the pattern is a regular expression the browser (and so the validator on the server) accepts. */
export function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
}

// --- Discount matrix ---

export const PRIORITY_STEP = 10;

export function emptyRule(priority: number): CcvDiscountRule {
  return {
    priority,
    rule_type: 'GLOBAL_PERCENTAGE',
    target_price_list_id: null,
    target_category_id: null,
    discount_percentage: 10,
    exclude_promotional_items: true,
    cumulative_with_other_discounts: false,
    min_cart_amount: null,
  };
}

/** Rules in the order they are tried (ascending priority, stable). */
export function sortRules(rules: readonly CcvDiscountRule[]): CcvDiscountRule[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => a.rule.priority - b.rule.priority || a.index - b.index)
    .map(({ rule }) => rule);
}

/** Moves a rule one position up (-1) or down (+1) and renumbers the priorities in steps of ten. */
export function moveRule(
  rules: readonly CcvDiscountRule[],
  index: number,
  delta: -1 | 1,
): CcvDiscountRule[] {
  const ordered = sortRules(rules);
  const target = index + delta;
  if (index < 0 || index >= ordered.length || target < 0 || target >= ordered.length) {
    return renumber(ordered);
  }
  const copy = [...ordered];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return renumber(copy);
}

export function renumber(rules: readonly CcvDiscountRule[]): CcvDiscountRule[] {
  return rules.map((rule, index) => ({ ...rule, priority: (index + 1) * PRIORITY_STEP }));
}

/** The problems of a matrix, as the codes the API would refuse it with (`discount_*`), so the form can warn before saving. */
export function matrixProblems(rules: readonly CcvDiscountRule[]): { row: number; code: string }[] {
  const problems: { row: number; code: string }[] = [];
  const priorities = new Set<number>();
  rules.forEach((rule, index) => {
    const row = index + 1;
    const percentage = toNumber(rule.discount_percentage);
    if (percentage < 0 || percentage > 100) {
      problems.push({ row, code: 'discount_percentage_out_of_range' });
    } else if (rule.rule_type !== 'PRICE_LIST' && percentage === 0) {
      problems.push({ row, code: 'discount_percentage_required' });
    }
    if (rule.rule_type === 'PRICE_LIST' && !rule.target_price_list_id) {
      problems.push({ row, code: 'discount_rule_target_missing' });
    }
    if (
      (rule.rule_type === 'CATEGORY_PERCENTAGE' ||
        rule.rule_type === 'PRODUCT_FAMILY_PERCENTAGE') &&
      !rule.target_category_id
    ) {
      problems.push({ row, code: 'discount_rule_target_missing' });
    }
    if (priorities.has(rule.priority)) {
      problems.push({ row, code: 'discount_priority_duplicated' });
    }
    priorities.add(rule.priority);
  });
  return problems;
}

// --- Convention form ---

export function emptyConvention(country: 'IT' | 'CH' = 'IT'): CcvConventionPayload {
  return {
    code: '',
    slug: null,
    name: '',
    partner_company_name: '',
    partner_vat_number: null,
    partner_uid_number: null,
    partner_type: 'CORPORATE',
    country_code: country,
    currency: country === 'CH' ? 'CHF' : 'EUR',
    valid_from: toDateString(new Date()),
    valid_to: null,
    eligible_population: null,
    hr_contact_name: null,
    hr_contact_email: null,
    hr_contact_phone: null,
    verification_methods: ['WORK_EMAIL_OTP'],
    allowed_email_domains: [],
    card_number_prefix: null,
    card_number_regex: null,
    static_convention_code: null,
    allow_family_members: false,
    max_family_members: 0,
    annual_spending_cap_per_beneficiary: null,
    employer_subsidy_enabled: false,
    employer_subsidy_type: null,
    employer_subsidy_value: null,
    employer_subsidy_annual_cap: null,
    subsidy_purpose: 'GENERAL',
    split_billing_anonymized: true,
    billing_cycle: 'MONTHLY',
    primary_color: '#1f4e79',
    welcome_message_key: null,
    discount_rules: [emptyRule(PRIORITY_STEP)],
  };
}

function nullableNumber(value: string | null | undefined): number | null {
  return value === null || value === undefined || value === '' ? null : toNumber(value);
}

/** The payload to edit a stored convention (the API reports decimals as strings). */
export function conventionToPayload(convention: CcvConvention): CcvConventionPayload {
  return {
    code: convention.code,
    slug: convention.slug,
    name: convention.name,
    partner_company_name: convention.partner_company_name,
    partner_vat_number: convention.partner_vat_number,
    partner_uid_number: convention.partner_uid_number,
    partner_type: convention.partner_type,
    country_code: convention.country_code,
    currency: convention.currency,
    valid_from: convention.valid_from,
    valid_to: convention.valid_to,
    eligible_population: convention.eligible_population,
    hr_contact_name: convention.hr_contact_name,
    hr_contact_email: convention.hr_contact_email,
    hr_contact_phone: convention.hr_contact_phone,
    verification_methods: [...convention.verification_methods],
    allowed_email_domains: [...convention.allowed_email_domains],
    card_number_prefix: convention.card_number_prefix,
    card_number_regex: convention.card_number_regex,
    static_convention_code: convention.static_convention_code,
    allow_family_members: convention.allow_family_members,
    max_family_members: convention.max_family_members,
    annual_spending_cap_per_beneficiary: nullableNumber(
      convention.annual_spending_cap_per_beneficiary,
    ),
    employer_subsidy_enabled: convention.employer_subsidy_enabled,
    employer_subsidy_type: convention.employer_subsidy_type,
    employer_subsidy_value: nullableNumber(convention.employer_subsidy_value),
    employer_subsidy_annual_cap: nullableNumber(convention.employer_subsidy_annual_cap),
    subsidy_purpose: convention.subsidy_purpose,
    split_billing_anonymized: convention.split_billing_anonymized,
    billing_cycle: convention.billing_cycle,
    primary_color: convention.primary_color,
    welcome_message_key: convention.welcome_message_key,
    discount_rules: sortRules(convention.discount_rules ?? []).map((rule) => ({
      priority: rule.priority,
      rule_type: rule.rule_type,
      target_price_list_id: rule.target_price_list_id,
      target_category_id: rule.target_category_id,
      discount_percentage: toNumber(rule.discount_percentage),
      exclude_promotional_items: rule.exclude_promotional_items,
      cumulative_with_other_discounts: rule.cumulative_with_other_discounts,
      min_cart_amount: nullableNumber(
        rule.min_cart_amount === null ? null : String(rule.min_cart_amount),
      ),
    })),
  };
}

/** Keeps the data that belongs to the chosen verification methods and the subsidy only when it is enabled. */
export function cleanPayload(payload: CcvConventionPayload): CcvConventionPayload {
  const methods = new Set(payload.verification_methods);
  const subsidy = payload.employer_subsidy_enabled;
  const country = payload.country_code;
  return {
    ...payload,
    currency: country === 'CH' ? 'CHF' : 'EUR',
    partner_vat_number: country === 'IT' ? emptyToNull(payload.partner_vat_number) : null,
    partner_uid_number: country === 'CH' ? emptyToNull(payload.partner_uid_number) : null,
    slug: emptyToNull(payload.slug ?? null),
    allowed_email_domains: methods.has('WORK_EMAIL_OTP')
      ? payload.allowed_email_domains.map(normalizeDomain).filter((domain) => domain !== '')
      : [],
    card_number_prefix: methods.has('MEMBERSHIP_CARD_PREFIX')
      ? emptyToNull(payload.card_number_prefix)
      : null,
    card_number_regex: methods.has('MEMBERSHIP_CARD_PREFIX')
      ? emptyToNull(payload.card_number_regex)
      : null,
    static_convention_code: methods.has('PROMO_CODE')
      ? emptyToNull(payload.static_convention_code)
      : null,
    max_family_members: payload.allow_family_members ? payload.max_family_members : 0,
    employer_subsidy_type: subsidy ? payload.employer_subsidy_type : null,
    employer_subsidy_value: subsidy ? payload.employer_subsidy_value : null,
    employer_subsidy_annual_cap: subsidy ? payload.employer_subsidy_annual_cap : null,
    discount_rules: payload.discount_rules.map((rule) => ({
      ...rule,
      target_price_list_id: rule.rule_type === 'PRICE_LIST' ? rule.target_price_list_id : null,
      target_category_id:
        rule.rule_type === 'CATEGORY_PERCENTAGE' || rule.rule_type === 'PRODUCT_FAMILY_PERCENTAGE'
          ? rule.target_category_id
          : null,
    })),
  };
}

function emptyToNull(value: string | null): string | null {
  return value === null || value.trim() === '' ? null : value.trim();
}

// --- Welfare ---

/** The providers a jurisdiction accepts, with the categories each one pays and its default merchant fee. */
export function providersOf(
  lookups: CcvLookups | null,
  jurisdiction: CcvWelfareJurisdiction,
): CcvWelfareProviderOption[] {
  return lookups?.welfare_providers[jurisdiction] ?? [];
}

/** The jurisdiction that matches the currency of the sale: EUR pays under Art. 51 TUIR, CHF with Reka / Lunch-Check. */
export function jurisdictionOfCurrency(currency: string): CcvWelfareJurisdiction {
  return currency === 'CHF' ? 'CH_REKA_LUNCHCHECK' : 'IT_ART51_TUIR';
}

/** The fee and the net a voucher leaves the merchant, for the preview at the till (the API recomputes them). */
export function voucherSplit(gross: number, feePercentage: number): { fee: number; net: number } {
  const fee = Math.round(gross * feePercentage) / 100;
  return { fee, net: Math.round((gross - fee) * 100) / 100 };
}

// --- Files ---

/** Hands a downloaded blob to the browser as a file. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Settlement statement ---

/**
 * The lines of a provider statement pasted as text: one voucher per line, "code;amount" (comma, semicolon, tab or space as separator,
 * decimal comma accepted). Lines that do not hold a code and a positive amount are returned as errors with their line number.
 */
export function parseStatement(text: string): {
  lines: { voucher_code: string; settled_amount: number }[];
  invalid: number[];
} {
  const lines: { voucher_code: string; settled_amount: number }[] = [];
  const invalid: number[] = [];
  text.split(/\r\n|\r|\n/u).forEach((row, index) => {
    const trimmed = row.trim();
    if (trimmed === '') {
      return;
    }
    const match = /^(\S+?)[;,\t ]+(\d+(?:[.,]\d+)?)$/u.exec(trimmed);
    if (match === null) {
      invalid.push(index + 1);
      return;
    }
    const code = match[1];
    const amount = Number(match[2].replace(',', '.'));
    lines.push({ voucher_code: code, settled_amount: amount });
  });
  return { lines, invalid };
}
