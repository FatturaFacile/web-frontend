import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { vi } from 'vitest';
import { icons } from '../../icons-provider';
import {
  PermissionsService,
  SfArtifact,
  SfDossier,
  SfDossierSummary,
  SfEligibility,
  SfEnvelope,
  SfIndicatorsResult,
  SfLine,
  SfLookups,
  SfNotes,
  SfPackage,
  SfPreview,
  SfValidationReport,
  StatutoryFinancialsApiService,
  TranslateService,
} from '@core';

/** Wraps data in the envelope the API answers. */
export function wrap<T>(data: T): SfEnvelope<T> {
  return { success: true, message: 'ok', data };
}

export function translateSpy() {
  return {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

export function line(code: string, extra: Partial<SfLine> = {}): SfLine {
  return {
    code,
    parent_code: null,
    sign: 1,
    side: 'asset',
    sort_order: 0,
    level: 0,
    is_leaf: true,
    is_total: false,
    is_rounding: false,
    xbrl_element: `it-gaap:${code}`,
    amount: '1000.0000',
    exact_amount: '1000.0000',
    comparative_amount: '900.0000',
    label: `Line ${code}`,
    ...extra,
  };
}

export const lookups: SfLookups = {
  locale: 'en',
  standards: [
    {
      value: 'IT_OIC_Ordinario',
      jurisdiction: 'IT',
      scheme: 'ord',
      legal_reference: 'art. 2423 c.c.',
      label: 'OIC ordinary accounts',
      description: 'Full civil-code accounts.',
      income_statement_methods: ['total_cost'],
      cash_flow_methods: ['indirect', 'direct'],
      cash_flow_label: 'OIC 10',
      pdfa_profile: 'PDF/A-1b',
      notes: {
        sections: ['intro', 'policies'],
        tables: ['fixed_assets', 'maturity', 'off_balance'],
      },
    },
    {
      value: 'CH_SwissGaapFer',
      jurisdiction: 'CH',
      scheme: 'ord',
      legal_reference: 'FER 4',
      label: 'Swiss GAAP FER',
      description: 'True and fair view.',
      income_statement_methods: ['total_cost', 'cost_of_sales'],
      cash_flow_methods: ['indirect'],
      cash_flow_label: 'FER 4',
      pdfa_profile: 'PDF/A-2b',
      notes: { sections: ['intro'], tables: ['equity', 'taxes'] },
    },
  ],
  rounding_modes: [
    { value: 'ExactCents', scale: 2 },
    { value: 'IntegerUnits_Euro_Chf', scale: 0 },
  ],
  statuses: ['draft', 'reclassified', 'notes_populated', 'validated', 'locked', 'filed'],
  fiscal_years: [
    { id: 'fy-2025', year_code: '2025', start_date: '2025-01-01', end_date: '2025-12-31' },
    { id: 'fy-2024', year_code: '2024', start_date: '2024-01-01', end_date: '2024-12-31' },
  ],
  labels: {
    'report.balance_sheet': { title: 'Stato patrimoniale', body: '' },
    'report.income_statement': { title: 'Conto economico', body: '' },
    'report.current': { title: '2025', body: '' },
    'report.comparative': { title: '2024', body: '' },
    'bifront.asset_side': { title: 'Attivo', body: '' },
    'bifront.liability_side': { title: 'Passivo', body: '' },
    'rounding.reserve_label': { title: 'Riserva da arrotondamento', body: '' },
  },
  narrative_templates: [
    {
      key: 'profit_allocation.minutes',
      family: 'minutes',
      title: 'Destinazione utile',
      body: 'Si propone...',
      placeholders: [],
    },
  ],
  ratios: [],
  what_if_parameters: [
    'ebitda_change_percent',
    'revenue_change_percent',
    'debt_service_change_percent',
    'extra_liquidity',
    'expected_cash_flow_6m',
    'debt_service_6m',
    'opening_liquidity',
  ],
};

export function summary(id: string, extra: Partial<SfDossierSummary> = {}): SfDossierSummary {
  return {
    id,
    title: `Accounts ${id}`,
    fiscal_year_id: 'fy-2025',
    fiscal_year: {
      id: 'fy-2025',
      year_code: '2025',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
    },
    comparative_prior_year_id: 'fy-2024',
    accounting_standard: 'IT_OIC_Ordinario',
    status: 'draft',
    rounding_to_unit_mode: 'ExactCents',
    income_statement_method: 'total_cost',
    cash_flow_method: 'indirect',
    locale: 'it',
    currency: 'EUR',
    has_statements: false,
    validation_status: null,
    net_result: '12345.6700',
    generated_at: null,
    validated_at: null,
    locked_at: null,
    filed_at: null,
    created_at: '2026-01-10T10:00:00Z',
    ...extra,
  };
}

export function dossier(id = 'd-1', extra: Partial<SfDossier> = {}): SfDossier {
  return {
    ...summary(id, { has_statements: true }),
    share_capital: '10000.0000',
    options: null,
    statements: {
      balance_sheet: {
        lines: [
          line('A', {
            level: 0,
            is_leaf: false,
            side: 'subtotal',
            is_total: true,
            label: 'Total assets',
          }),
          line('A.I', { parent_code: 'A', level: 1, label: 'Fixed assets', amount: '600.0000' }),
          line('A.R', {
            parent_code: 'A',
            level: 1,
            is_rounding: true,
            label: 'Arrotondamenti attivi',
            amount: '1.0000',
          }),
        ],
        total_assets: '1234.5000',
        total_liabilities_equity: '1234.5000',
      },
      income_statement: {
        method: 'total_cost',
        lines: [line('C', { side: 'revenue', label: 'Revenue' })],
        net_result: '12345.6700',
      },
      cash_flow: {
        method: 'indirect',
        lines: [line('F', { side: 'flow', label: 'Operating flow' })],
        opening_cash: '100.0000',
        closing_cash: '150.0000',
        balance_sheet_cash: '150.0000',
        unexplained: '0.0000',
        reconciled: true,
        residual: '0.0000',
        standard_label: 'OIC 10',
      },
    },
    quadrature: {
      scale: 0,
      rounding_reserve: '2.0000',
      rounding_income: '1.0000',
      rounding_cost: '0.0000',
      balance_sheet_residual: '0.0000',
      income_statement_residual: '0.0000',
      reserve_line_code: 'A.R',
      income_line_code: null,
      cost_line_code: null,
    },
    reclassification: {
      bifront: [
        {
          account_code: '1100',
          account_name: 'Customers',
          balance: '-50.0000',
          line: 'A.I',
          line_label: 'Fixed assets',
          side: 'opposite',
        },
      ],
      unmapped: [{ account_code: '9999', account_name: 'Suspense', line: null, line_label: null }],
      warnings: [
        {
          code: 'bifront_account',
          severity: 'warning',
          params: {},
          message: 'Account 1100 sits on the opposite side.',
        },
      ],
    },
    eligibility: null,
    profit_allocation_proposal: {
      article: 'art. 2430 c.c.',
      net_profit: '12345.6700',
      carried_forward_in: '0.0000',
      balance_sheet_profit: '12345.6700',
      share_capital: '10000.0000',
      legal_reserve_cap: '2000.0000',
      legal_reserve_existing: '1900.0000',
      legal_reserve_room: '100.0000',
      legal_reserve_allocation: '100.0000',
      legal_reserve_cap_reached: true,
      dividends: '5000.0000',
      other_reserves: '1000.0000',
      carried_forward_out: '6245.6700',
      warnings: ['Legal reserve cap reached.'],
    },
    hidden_reserves_config: null,
    cash_flow_statement: { method: 'indirect', reconciled: true, standard_label: 'OIC 10' },
    notes: null,
    package: null,
    artifacts: [],
    filing_reference: null,
    ...extra,
  };
}

export function eligibility(extra: Partial<SfEligibility> = {}): SfEligibility {
  return {
    recommended_standard: 'IT_OIC_Abbreviato',
    chosen_allowed: false,
    exceeded: ['assets'],
    limits: { assets_limit: '4400000', revenue_limit: '8800000', employees_limit: 50 },
    message_key: 'eligibility.not_allowed',
    message: { title: 'Ordinary accounts recommended', body: 'The thresholds were exceeded.' },
    warnings: [{ code: 'two_of_three', params: {}, message: 'Two of three limits exceeded.' }],
    required_statements: ['balance_sheet', 'cash_flow'],
    metrics: { total_assets: '5000000.0000', revenue: '9000000.0000', average_employees: 40 },
    cash_flow_required: true,
    ...extra,
  };
}

export function notes(extra: Partial<SfNotes> = {}): SfNotes {
  return {
    id: 'n-1',
    dossier_id: 'd-1',
    taxonomy_version: '2024-11-04',
    quantitative_tables: {
      fixed_assets: {
        source: 'Mod 019',
        available: true,
        fallback: true,
        rows: [
          {
            category_id: 'c-1',
            category: 'Plant',
            asset_type: 'tangible',
            opening_cost: '1000.00',
            additions: '100.00',
            disposals_cost: '0.00',
            revaluations: '0.00',
            impairments: '0.00',
            closing_cost: '1100.00',
            opening_accumulated: '200.00',
            depreciation: '50.00',
            disposals_accumulated: '0.00',
            closing_accumulated: '250.00',
            net_book_value: '850.00',
          },
        ],
        totals: { closing_cost: '1100.00' },
      },
      maturity: {
        source: 'Mod 017',
        available: true,
        receivables: {
          within_1y: '100.00',
          between_1y_5y: '50.00',
          beyond_5y: '0.00',
          total: '150.00',
          secured: '10.00',
        },
        payables: {
          within_1y: '80.00',
          between_1y_5y: '20.00',
          beyond_5y: '5.00',
          total: '105.00',
          secured: '0.00',
        },
      },
      off_balance: {
        rows: [{ type: 'guarantee', description: 'Bank guarantee', amount: '5000.00' }],
      },
    },
    narrative_text_sections: [
      { key: 'intro', title: 'Introduction', body: 'The accounts are drawn up...', edited: false },
      { key: 'policies', title: 'Accounting policies', body: 'Policies...', edited: true },
      { key: 'hidden', title: 'Not for this standard', body: 'x', edited: false },
    ],
    sources: { fixed_assets: 'Mod 019 fixed assets register', maturity: 'Mod 017 due dates' },
    populated_at: '2026-02-01T10:00:00Z',
    ...extra,
  };
}

export function indicators(extra: Partial<SfIndicatorsResult> = {}): SfIndicatorsResult {
  return {
    indicators: [
      {
        code: 'current_ratio',
        label: 'Current ratio',
        description: 'Current assets over current liabilities.',
        unit: 'ratio',
        value: '1.2000',
        status: 'warning',
        direction: 'min',
        warning_threshold: '1.5000',
        critical_threshold: '1.0000',
        is_crisis_indicator: true,
        message: 'Below the warning threshold.',
      },
      {
        code: 'roe',
        label: 'ROE',
        description: 'Return on equity.',
        unit: 'percent',
        value: '8.5000',
        status: 'ok',
        direction: null,
        warning_threshold: null,
        critical_threshold: null,
        is_crisis_indicator: false,
        message: null,
      },
    ],
    alert_level: 'warning',
    alerts: [{ code: 'current_ratio', status: 'warning', message: 'Current ratio is low.' }],
    dscr: {
      horizon_months: 6,
      expected_cash_flow: '500.0000',
      opening_liquidity: '200.0000',
      debt_service: '400.0000',
      value: '1.7500',
    },
    what_if: {},
    inputs: {},
    ...extra,
  };
}

export function report(extra: Partial<SfValidationReport> = {}): SfValidationReport {
  return {
    status: 'warnings',
    taxonomy_version: '2024-11-04',
    entry_point: 'itcc-ci-2024-11-04.xsd',
    facts: 120,
    errors: [],
    warnings: [
      {
        severity: 'warning',
        category: 'notes',
        code: 'notes.empty',
        params: {},
        message: 'The notes table is empty.',
      },
    ],
    info: [],
    scope: 'full',
    validated_at: '2026-02-02T10:00:00Z',
    ...extra,
  };
}

export function artifact(id: string, extra: Partial<SfArtifact> = {}): SfArtifact {
  return {
    id,
    dossier_id: 'd-1',
    kind: 'pdfa_management_report',
    file_name: `report-${id}.pdf`,
    mime_type: 'application/pdf',
    size_bytes: 2048,
    sha256: 'abcdef0123456789'.repeat(4),
    pdfa_conformance: 'PDF/A-1b',
    verification: null,
    created_at: '2026-02-03T10:00:00Z',
    ...extra,
  };
}

export function pack(extra: Partial<SfPackage> = {}): SfPackage {
  return {
    id: 'p-1',
    dossier_id: 'd-1',
    generated_xbrl_instance_file_id: 'x-1',
    tebeni_validation_report: report(),
    validation_status: 'warnings',
    management_report_pdf_a_id: null,
    shareholders_minutes_pdf_a_id: null,
    board_minutes_pdf_a_id: null,
    dossier_pdf_a_id: null,
    financial_ratios_crisi_impresa: null,
    exported_at: '2026-02-02T10:00:00Z',
    ...extra,
  };
}

export function preview(extra: Partial<SfPreview> = {}): SfPreview {
  return {
    title: 'Bilancio 2025',
    standard: 'IT_OIC_Ordinario',
    legal_reference: 'art. 2423 c.c.',
    scale: 0,
    currency: 'EUR',
    taxonomy: {
      version: '2024-11-04',
      prefix: 'itcc-ci',
      namespace: 'http://xbrl.org/it/fr/gaap/ci/2024-11-04',
      entry_point: 'itcc-ci-2024-11-04.xsd',
    },
    has_comparative: true,
    sections: [
      {
        statement: 'balance_sheet',
        title: 'Stato patrimoniale',
        rows: [
          {
            code: 'A',
            label: 'Totale attivo',
            level: 0,
            is_total: true,
            is_rounding: false,
            xbrl_element: 'itcc-ci:TotaleAttivo',
            amount: '1234.0000',
            comparative_amount: '1100.0000',
          },
        ],
      },
    ],
    notes: {
      tables: { off_balance: { rows: [] } },
      sections: [{ key: 'intro', title: 'Introduzione', body: '...', edited: false }],
    },
    validation: report(),
    xbrl_excerpt: '<xbrli:xbrl>...</xbrli:xbrl>',
    xbrl_truncated: true,
    ...extra,
  };
}

/** Providers every component of the module needs: the API double, access, messages, translation and routing. */
export function baseProviders(
  api: unknown,
  canWrite: () => boolean = () => true,
  dossierId: string | null = 'd-1',
): (Provider | EnvironmentProviders)[] {
  return [
    // The router goes first: it provides its own ActivatedRoute, which would override the double below.
    provideRouter([]),
    { provide: StatutoryFinancialsApiService, useValue: api },
    { provide: PermissionsService, useValue: { canWrite } },
    { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
    { provide: TranslateService, useValue: translateSpy() },
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: { paramMap: convertToParamMap(dossierId === null ? {} : { id: dossierId }) },
        parent: null,
      },
    },
    provideNzIcons(icons),
  ];
}
