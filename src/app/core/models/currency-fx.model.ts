/**
 * Multi-currency engine (Mod 003): exchange rates, the ECB / SNB / ESTV synchronisation, the currency settings, the
 * open-position exposure and the period-end FX revaluation. Rates and amounts are decimal STRINGS: they are shown and
 * sent as they are and never converted to a float for a payload.
 */

export type CurrencyRateType = 'mid' | 'buy' | 'sell' | 'contract' | 'vat_estv_monthly' | 'closing';

/** Rate types a user may enter by hand (the API refuses the others for manual rates). */
export const MANUAL_RATE_TYPES: readonly CurrencyRateType[] = [
  'mid',
  'buy',
  'sell',
  'contract',
  'closing',
  'vat_estv_monthly',
];

export const ALL_RATE_TYPES: readonly CurrencyRateType[] = MANUAL_RATE_TYPES;

export type CurrencyRateSource = 'ecb' | 'snb' | 'estv' | 'manual';

export type CurrencyProvider = 'ecb' | 'snb' | 'estv';

export const CURRENCY_PROVIDERS: readonly CurrencyProvider[] = ['ecb', 'snb', 'estv'];

export interface CurrencyRate {
  id: string;
  base: string;
  quote: string;
  rate: string;
  rate_type: CurrencyRateType;
  source: CurrencyRateSource;
  valid_on: string;
  is_derived: boolean;
  is_contract: boolean;
  superseded_by: string | null;
  /** `null` = official shared rate, otherwise a rate of the tenant. */
  tenant_id: string | null;
  reason: string | null;
  contract_reference: string | null;
  created_at: string;
}

export interface CurrencyRateFilters {
  base?: string;
  quote?: string;
  rate_type?: CurrencyRateType | '';
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}

export interface CurrencyRatePayload {
  base: string;
  quote: string;
  /** Decimal string with at most six decimals. */
  rate: string;
  valid_on: string;
  rate_type: CurrencyRateType;
  reason?: string | null;
  contract_reference?: string | null;
}

export interface CurrencyRateResolveQuery {
  base: string;
  quote: string;
  date: string;
  rate_type?: CurrencyRateType;
  contract_reference?: string | null;
}

export interface ResolvedCurrencyRate {
  base: string;
  quote: string;
  rate: string;
  rate_type: CurrencyRateType;
  source: CurrencyRateSource;
  /** Date of the rate actually used. */
  valid_on: string;
  requested_date: string;
  is_derived: boolean;
  is_contract: boolean;
  is_fallback_date: boolean;
  rate_id: string | null;
}

export type CurrencyExportFormat = 'csv' | 'xlsx';

export type CurrencySyncStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface CurrencySyncRun {
  id: string;
  provider: CurrencyProvider;
  status: CurrencySyncStatus;
  trigger: 'scheduled' | 'manual';
  started_at: string | null;
  finished_at: string | null;
  rates_count: number;
  derived_count: number;
  error_message: string | null;
}

export interface CurrencySyncResult {
  runs: CurrencySyncRun[];
}

// --- Exposure ---

export interface CurrencyExposureItem {
  currency: string;
  receivables: string;
  payables: string;
  bank: string;
  cash: string;
  net_amount: string;
  historical_value: string;
  current_value: string;
  closing_rate: string | null;
  unrealized_gain_loss: string;
  rate_missing: boolean;
}

export interface CurrencyExposure {
  as_of: string;
  functional_currency: string;
  totals: {
    historical_value: string;
    current_value: string;
    unrealized_gain_loss: string;
  };
  items: CurrencyExposureItem[];
}

// --- Settings ---

export type UnrealizedGainTreatment = 'recognise' | 'provision' | 'suppress';

export const UNREALIZED_GAIN_TREATMENTS: readonly UnrealizedGainTreatment[] = [
  'recognise',
  'provision',
  'suppress',
];

export type VatRateMethod = 'estv_monthly' | 'daily' | 'ecb';

export const VAT_RATE_METHODS: readonly VatRateMethod[] = ['estv_monthly', 'daily', 'ecb'];

export interface CurrencySettings {
  functional_currency: string;
  active_currencies: string[];
  alert_threshold_percent: string;
  unrealized_gain_treatment: UnrealizedGainTreatment;
  vat_rate_method: VatRateMethod;
}

export type CurrencySettingsPayload = Omit<CurrencySettings, 'functional_currency'>;

// --- FX revaluation ---

export type FxRevaluationStatus = 'draft' | 'posted' | 'reversed';

export type FxRevaluationPeriodType = 'monthly' | 'quarterly' | 'annual';

export const FX_REVALUATION_PERIOD_TYPES: readonly FxRevaluationPeriodType[] = [
  'monthly',
  'quarterly',
  'annual',
];

export type FxRevaluationLineType = 'receivable' | 'payable' | 'bank' | 'cash';

export type FxRevaluationResult = 'gain' | 'loss' | 'neutral';

export interface FxRevaluationRunLine {
  id: string;
  line_type: FxRevaluationLineType;
  currency: string;
  reference: string | null;
  currency_balance: string;
  book_value: string;
  closing_rate: string;
  revalued_value: string;
  difference: string;
  result: FxRevaluationResult;
  treatment: UnrealizedGainTreatment;
}

export interface FxRevaluationRun {
  id: string;
  status: FxRevaluationStatus;
  period_end: string;
  period_type: FxRevaluationPeriodType;
  functional_currency: string;
  total_gain: string;
  total_loss: string;
  net_result: string;
  journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  posted_at: string | null;
  reversed_at: string | null;
  lines?: FxRevaluationRunLine[];
}

export interface FxRevaluationSimulatePayload {
  period_end: string;
  period_type: FxRevaluationPeriodType;
  currencies?: string[];
}

export interface FxRevaluationFilters {
  per_page?: number;
  page?: number;
}

/** RFC 7807-like problem with the `code` and the field errors the currency endpoints answer with. */
export interface CurrencyProblem {
  success?: boolean;
  message?: string;
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}
