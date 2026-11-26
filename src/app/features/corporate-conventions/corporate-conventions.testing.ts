import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { NzMessageService } from 'ng-zorro-antd/message';
import { vi } from 'vitest';
import { icons } from '../../icons-provider';
import {
  CcvConvention,
  CcvEnrollment,
  CcvEnvelope,
  CcvLookups,
  CcvPage,
  CcvPass,
  CorporateConventionsApiService,
  PermissionsService,
  TranslateService,
} from '@core';

/** Wraps data in the envelope the API answers. */
export function wrap<T>(data: T): CcvEnvelope<T> {
  return { success: true, message: 'ok', data };
}

export function page<T>(data: T[], total = data.length): CcvPage<T> {
  return {
    success: true,
    message: 'ok',
    data,
    meta: { current_page: 1, per_page: 25, total, last_page: 1 },
  };
}

export function translateSpy() {
  return {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

export const lookups: CcvLookups = {
  partner_types: ['CORPORATE', 'CRAL'],
  convention_statuses: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED'],
  verification_methods: [
    'WORK_EMAIL_OTP',
    'MEMBERSHIP_CARD_PREFIX',
    'HASHED_EMPLOYEE_LIST',
    'PROMO_CODE',
  ],
  rule_types: [
    'PRICE_LIST',
    'CATEGORY_PERCENTAGE',
    'PRODUCT_FAMILY_PERCENTAGE',
    'GLOBAL_PERCENTAGE',
  ],
  subsidy_types: ['FIXED_AMOUNT', 'PERCENTAGE'],
  subsidy_purposes: ['DLGS_81_08_VDT', 'PREVENTIVE_HEALTHCARE', 'SPORTS_WELLNESS', 'GENERAL'],
  billing_cycles: ['MONTHLY', 'QUARTERLY', 'IMMEDIATE'],
  relationships: ['SPOUSE', 'CHILD', 'PARENT'],
  welfare_jurisdictions: ['IT_ART51_TUIR', 'CH_REKA_LUNCHCHECK'],
  welfare_categories: [
    'EDUCATION',
    'HEALTHCARE',
    'SPORTS_FITNESS',
    'CULTURE_LEISURE',
    'SHOPPING_VOUCHER_EXEMPT',
    'MEAL_VOUCHER',
  ],
  welfare_providers: {
    IT_ART51_TUIR: [
      {
        provider: 'EDENRED',
        categories: ['EDUCATION', 'HEALTHCARE', 'MEAL_VOUCHER'],
        default_fee_percentage: '8.00',
      },
    ],
    CH_REKA_LUNCHCHECK: [
      { provider: 'LUNCH_CHECK', categories: ['MEAL_VOUCHER'], default_fee_percentage: '1.50' },
      {
        provider: 'REKA_CARD',
        categories: ['CULTURE_LEISURE', 'SPORTS_FITNESS'],
        default_fee_percentage: '1.50',
      },
    ],
  },
  price_lists: [{ id: 'pl-1', name: 'Welfare list', currency: 'EUR' }],
  categories: [{ id: 'cat-1', name: 'Eyewear', parent_id: null }],
  conventions: [{ id: 'c-1', name: 'Acme', code: 'ACME', currency: 'EUR', country_code: 'IT' }],
};

export function convention(id: string, extra: Partial<CcvConvention> = {}): CcvConvention {
  return {
    id,
    code: `CODE-${id}`,
    slug: `convention-${id}`,
    landing_path: `/convenzioni/convention-${id}`,
    name: `Convention ${id}`,
    partner_company_name: `Partner ${id} Srl`,
    partner_vat_number: '12345678901',
    partner_uid_number: null,
    partner_contact_id: null,
    partner_type: 'CORPORATE',
    country_code: 'IT',
    currency: 'EUR',
    valid_from: '2028-01-01',
    valid_to: '2028-12-31',
    status: 'ACTIVE',
    eligible_population: 500,
    hr_contact_name: null,
    hr_contact_email: null,
    hr_contact_phone: null,
    has_contract_document: false,
    verification_methods: ['WORK_EMAIL_OTP'],
    allowed_email_domains: ['@partner.it'],
    card_number_prefix: null,
    card_number_regex: null,
    static_convention_code: null,
    allow_family_members: true,
    max_family_members: 3,
    annual_spending_cap_per_beneficiary: '1000.00',
    employer_subsidy_enabled: true,
    employer_subsidy_type: 'PERCENTAGE',
    employer_subsidy_value: '20.0000',
    employer_subsidy_annual_cap: '200.00',
    subsidy_purpose: 'DLGS_81_08_VDT',
    split_billing_anonymized: true,
    billing_cycle: 'MONTHLY',
    has_logo: false,
    primary_color: '#1f4e79',
    welcome_message_key: null,
    enrolled_employees_count: 12,
    enrolled_family_count: 4,
    discount_rules: [
      {
        id: 'r-1',
        priority: 10,
        rule_type: 'GLOBAL_PERCENTAGE',
        target_price_list_id: null,
        target_category_id: null,
        discount_percentage: '15.0000',
        exclude_promotional_items: true,
        cumulative_with_other_discounts: false,
        min_cart_amount: null,
      },
    ],
    ...extra,
  };
}

export function enrollment(id: string, extra: Partial<CcvEnrollment> = {}): CcvEnrollment {
  return {
    id,
    convention_id: 'c-1',
    convention_name: 'Acme',
    currency: 'EUR',
    customer_id: 'cust-1',
    beneficiary_type: 'PRIMARY_EMPLOYEE',
    parent_enrollment_id: null,
    relationship: 'SELF',
    full_name: 'Mario Rossi',
    verified_email: 'mario@partner.it',
    membership_card_number: null,
    verification_method: 'WORK_EMAIL_OTP',
    verified_at: '2028-02-01T10:00:00Z',
    expires_at: '2029-02-01T10:00:00Z',
    status: 'ACTIVE',
    wallet_pass_id: '0192f0f0-0000-7000-8000-000000000001',
    qr_payload: 'FFCONV:0192f0f0-0000-7000-8000-000000000001',
    annual_used_amount: '250.00',
    annual_used_subsidy: '20.00',
    annual_spending_cap: '1000.00',
    annual_cap_remaining: '750.00',
    employer_subsidy_cap_remaining: '180.00',
    ...extra,
  };
}

export function pass(extra: Partial<CcvPass> = {}): CcvPass {
  return {
    wallet_pass_id: '0192f0f0-0000-7000-8000-000000000001',
    full_name: 'Mario Rossi',
    beneficiary_type: 'PRIMARY_EMPLOYEE',
    relationship: 'SELF',
    status: 'ACTIVE',
    expires_at: '2029-02-01T10:00:00Z',
    qr_payload: 'FFCONV:0192f0f0-0000-7000-8000-000000000001',
    convention: {
      name: 'Convention c-1',
      partner_company_name: 'Partner Srl',
      primary_color: '#1f4e79',
      allow_family_members: true,
      max_family_members: 2,
    },
    qr_svg_url: '/api/v1/public/conventions/passes/x/qr.svg',
    qr_png_url: '/api/v1/public/conventions/passes/x/qr.png',
    apple_wallet_url: null,
    google_wallet_url: 'https://pay.google.com/gp/v/save/jwt',
    family_members: [],
    can_add_family_member: true,
    ...extra,
  };
}

export function baseProviders(
  api: unknown,
  canWrite: (module?: string) => boolean = () => true,
  slug: string | null = 'acme',
): (Provider | EnvironmentProviders)[] {
  return [
    // The router goes first: it provides its own ActivatedRoute, which would override the double below.
    provideRouter([]),
    { provide: CorporateConventionsApiService, useValue: api },
    { provide: PermissionsService, useValue: { canWrite } },
    { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
    { provide: TranslateService, useValue: translateSpy() },
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: { paramMap: convertToParamMap(slug === null ? {} : { slug }) },
        parent: null,
      },
    },
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideNzDateFnsAdapter(),
  ];
}
