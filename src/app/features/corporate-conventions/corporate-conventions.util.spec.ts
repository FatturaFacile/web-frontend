import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  cleanPayload,
  conventionStatusColor,
  conventionToPayload,
  emptyConvention,
  emptyRule,
  errorKey,
  failureOf,
  identifierHint,
  isValidDomain,
  isValidPattern,
  jurisdictionOfCurrency,
  matrixProblems,
  moveRule,
  normalizeDomain,
  normalizeIdentifier,
  parseIdentifiers,
  parseStatement,
  previousMonth,
  providersOf,
  renumber,
  sha256Hex,
  shareOf,
  sortRules,
  toDateString,
  toNumber,
  voucherSplit,
} from './corporate-conventions.util';
import { convention, lookups } from './corporate-conventions.testing';

describe('corporate conventions util', () => {
  describe('errors', () => {
    it('turns the problem of the API into the translation key, the params and the field errors', () => {
      const outcome = failureOf(
        new HttpErrorResponse({
          status: 409,
          error: {
            code: 'family_limit_reached',
            params: { max: 3, nested: { a: 1 } },
            errors: { full_name: ['Required'] },
          },
        }),
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('corporateConventions.error.family_limit_reached');
      expect(outcome.params).toEqual({ max: 3 });
      expect(outcome.detail).toBe('Required');
    });

    it('falls back to the generic key when there is no problem body', () => {
      expect(failureOf(new Error('boom')).errorKey).toBe('corporateConventions.error.generic');
      expect(errorKey(null)).toBe('corporateConventions.error.generic');
    });
  });

  describe('employer list', () => {
    it('normalises like the server: no whitespace, upper case', () => {
      expect(normalizeIdentifier(' ab 12 3 ')).toBe('AB123');
      expect(identifierHint('ab 12345')).toBe('***345');
      expect(identifierHint('ab')).toBe('**');
    });

    it('hashes the normalised identifier with SHA-256', async () => {
      // SHA-256("AB123")
      expect(await sha256Hex('ab 123')).toBe(await sha256Hex('AB123'));
      expect(await sha256Hex('abc')).toBe(
        'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78',
      );
    });

    it('parses a pasted list or a CSV: first column, no header, no duplicates', () => {
      const text = 'matricola;name\r\nA001;Mario\nA002,Anna\n\n"A003"\na001 ;again\n';

      expect(parseIdentifiers(text)).toEqual(['A001', 'A002', 'A003']);
    });
  });

  describe('eligibility', () => {
    it('normalises and validates e-mail domains', () => {
      expect(normalizeDomain(' Partner.IT ')).toBe('@partner.it');
      expect(normalizeDomain('')).toBe('');
      expect(isValidDomain('@partner.ch')).toBe(true);
      expect(isValidDomain('partner')).toBe(false);
      expect(isValidDomain('@-bad.com')).toBe(false);
    });

    it('checks the card pattern is a regular expression', () => {
      expect(isValidPattern('^AC\\d{6}$')).toBe(true);
      expect(isValidPattern('([')).toBe(false);
    });
  });

  describe('discount matrix', () => {
    const rule = (priority: number, extra = {}) => ({ ...emptyRule(priority), ...extra });

    it('orders rules by priority and moves one step renumbering in tens', () => {
      const rules = [
        rule(30, { discount_percentage: 3 }),
        rule(10, { discount_percentage: 1 }),
        rule(20, { discount_percentage: 2 }),
      ];

      expect(sortRules(rules).map((r) => r.discount_percentage)).toEqual([1, 2, 3]);
      const moved = moveRule(rules, 0, 1);
      expect(moved.map((r) => r.discount_percentage)).toEqual([2, 1, 3]);
      expect(moved.map((r) => r.priority)).toEqual([10, 20, 30]);
      expect(moveRule(rules, 0, -1).map((r) => r.discount_percentage)).toEqual([1, 2, 3]);
      expect(renumber([rule(5), rule(5)]).map((r) => r.priority)).toEqual([10, 20]);
    });

    it('reports what the API would refuse: targets, percentages and duplicated priorities', () => {
      const problems = matrixProblems([
        rule(10, { rule_type: 'PRICE_LIST' }),
        rule(20, { rule_type: 'CATEGORY_PERCENTAGE' }),
        rule(20, { discount_percentage: 0 }),
        rule(30, { discount_percentage: 120 }),
      ]);

      expect(problems).toEqual([
        { row: 1, code: 'discount_rule_target_missing' },
        { row: 2, code: 'discount_rule_target_missing' },
        { row: 3, code: 'discount_percentage_required' },
        { row: 3, code: 'discount_priority_duplicated' },
        { row: 4, code: 'discount_percentage_out_of_range' },
      ]);
      expect(
        matrixProblems([
          rule(10),
          rule(20, {
            rule_type: 'PRICE_LIST',
            target_price_list_id: 'pl-1',
            discount_percentage: 0,
          }),
        ]),
      ).toEqual([]);
    });
  });

  describe('convention form', () => {
    it('starts as an Italian draft with an e-mail OTP, a monthly anonymized billing and one global rule', () => {
      const payload = emptyConvention();

      expect(payload.country_code).toBe('IT');
      expect(payload.currency).toBe('EUR');
      expect(payload.verification_methods).toEqual(['WORK_EMAIL_OTP']);
      expect(payload.split_billing_anonymized).toBe(true);
      expect(payload.discount_rules).toHaveLength(1);
      expect(emptyConvention('CH').currency).toBe('CHF');
    });

    it('turns a stored convention (decimal strings) into an editable payload with numbers', () => {
      const payload = conventionToPayload(convention('1'));

      expect(payload.annual_spending_cap_per_beneficiary).toBe(1000);
      expect(payload.employer_subsidy_value).toBe(20);
      expect(payload.discount_rules[0].discount_percentage).toBe(15);
      expect(payload.allowed_email_domains).toEqual(['@partner.it']);
    });

    it('keeps only the data of the chosen methods, the subsidy when enabled and the right tax number', () => {
      const cleaned = cleanPayload({
        ...emptyConvention('CH'),
        partner_vat_number: 'IT12345678901',
        partner_uid_number: 'CHE-123.456.789',
        verification_methods: ['MEMBERSHIP_CARD_PREFIX'],
        allowed_email_domains: ['Partner.CH'],
        card_number_prefix: 'AC',
        static_convention_code: 'PROMO',
        allow_family_members: false,
        max_family_members: 5,
        employer_subsidy_enabled: false,
        employer_subsidy_type: 'FIXED_AMOUNT',
        employer_subsidy_value: 30,
        discount_rules: [
          { ...emptyRule(10), rule_type: 'GLOBAL_PERCENTAGE', target_category_id: 'cat-1' },
        ],
      });

      expect(cleaned.partner_vat_number).toBeNull();
      expect(cleaned.partner_uid_number).toBe('CHE-123.456.789');
      expect(cleaned.allowed_email_domains).toEqual([]);
      expect(cleaned.card_number_prefix).toBe('AC');
      expect(cleaned.static_convention_code).toBeNull();
      expect(cleaned.max_family_members).toBe(0);
      expect(cleaned.employer_subsidy_type).toBeNull();
      expect(cleaned.employer_subsidy_value).toBeNull();
      expect(cleaned.discount_rules[0].target_category_id).toBeNull();
    });

    it('normalises the domains of an e-mail OTP convention', () => {
      const cleaned = cleanPayload({
        ...emptyConvention(),
        allowed_email_domains: ['Partner.IT', ' @acme.com '],
      });

      expect(cleaned.allowed_email_domains).toEqual(['@partner.it', '@acme.com']);
    });
  });

  describe('welfare', () => {
    it('lists the providers of a jurisdiction and picks the jurisdiction of the currency', () => {
      expect(providersOf(lookups, 'CH_REKA_LUNCHCHECK').map((option) => option.provider)).toEqual([
        'LUNCH_CHECK',
        'REKA_CARD',
      ]);
      expect(providersOf(null, 'IT_ART51_TUIR')).toEqual([]);
      expect(jurisdictionOfCurrency('CHF')).toBe('CH_REKA_LUNCHCHECK');
      expect(jurisdictionOfCurrency('EUR')).toBe('IT_ART51_TUIR');
    });

    it('previews the merchant fee and the net of a voucher to the cent', () => {
      expect(voucherSplit(100, 8)).toEqual({ fee: 8, net: 92 });
      expect(voucherSplit(33.33, 7.5)).toEqual({ fee: 2.5, net: 30.83 });
      expect(voucherSplit(50, 0)).toEqual({ fee: 0, net: 50 });
    });

    it('parses a provider statement and flags the lines that do not hold a code and an amount', () => {
      const result = parseStatement('ABC1234;12.50\nXYZ9876 7,25\n\nnonsense\nQQ11,10');

      expect(result.lines).toEqual([
        { voucher_code: 'ABC1234', settled_amount: 12.5 },
        { voucher_code: 'XYZ9876', settled_amount: 7.25 },
        { voucher_code: 'QQ11', settled_amount: 10 },
      ]);
      expect(result.invalid).toEqual([4]);
    });
  });

  describe('display helpers', () => {
    it('reads decimals for bars without turning them into money', () => {
      expect(toNumber('12.50')).toBe(12.5);
      expect(toNumber(null)).toBe(0);
      expect(toNumber('x')).toBe(0);
      expect(shareOf('25', '100')).toBe(25);
      expect(shareOf(500, 100)).toBe(100);
      expect(shareOf(5, 0)).toBe(0);
    });

    it('formats dates and the previous month', () => {
      expect(toDateString(new Date(2028, 0, 5))).toBe('2028-01-05');
      expect(previousMonth(new Date(2028, 0, 15))).toBe('2027-12');
      expect(previousMonth(new Date(2028, 5, 1))).toBe('2028-05');
    });

    it('colours the statuses', () => {
      expect(conventionStatusColor('ACTIVE')).toBe('green');
      expect(conventionStatusColor('EXPIRED')).toBe('red');
    });
  });
});
