import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { vi } from 'vitest';
import { icons } from '../../icons-provider';
import {
  ApiResponse,
  CurrencyApiService,
  CurrencyExposure,
  CurrencyRate,
  CurrencySettings,
  CurrencySyncRun,
  FxRevaluationRun,
  I18nService,
  PaginatedResponse,
  PermissionsService,
  ResolvedCurrencyRate,
} from '@core';

export function wrap<T>(data: T): ApiResponse<T> {
  return { success: true, message: 'ok', data };
}

export function page<T>(data: T[], total = data.length): PaginatedResponse<T> {
  return {
    success: true,
    message: 'ok',
    data,
    meta: { current_page: 1, from: 1, last_page: 1, per_page: 25, to: data.length, total },
  };
}

export function rate(id: string, extra: Partial<CurrencyRate> = {}): CurrencyRate {
  return {
    id,
    base: 'EUR',
    quote: 'CHF',
    rate: '0.941200',
    rate_type: 'mid',
    source: 'ecb',
    valid_on: '2026-11-20',
    is_derived: false,
    is_contract: false,
    superseded_by: null,
    tenant_id: null,
    reason: null,
    contract_reference: null,
    created_at: '2026-11-20T08:00:00Z',
    ...extra,
  };
}

export function resolved(extra: Partial<ResolvedCurrencyRate> = {}): ResolvedCurrencyRate {
  return {
    base: 'EUR',
    quote: 'CHF',
    rate: '0.941200',
    rate_type: 'mid',
    source: 'ecb',
    valid_on: '2026-11-20',
    requested_date: '2026-11-20',
    is_derived: false,
    is_contract: false,
    is_fallback_date: false,
    rate_id: 'r-1',
    ...extra,
  };
}

export function syncRun(id: string, extra: Partial<CurrencySyncRun> = {}): CurrencySyncRun {
  return {
    id,
    provider: 'ecb',
    status: 'succeeded',
    trigger: 'scheduled',
    started_at: '2026-11-20T06:00:00Z',
    finished_at: '2026-11-20T06:00:05Z',
    rates_count: 32,
    derived_count: 5,
    error_message: null,
    ...extra,
  };
}

export const settings: CurrencySettings = {
  functional_currency: 'CHF',
  active_currencies: ['CHF', 'EUR', 'USD'],
  alert_threshold_percent: '2.50',
  unrealized_gain_treatment: 'recognise',
  vat_rate_method: 'estv_monthly',
};

export function exposure(extra: Partial<CurrencyExposure> = {}): CurrencyExposure {
  return {
    as_of: '2026-11-26',
    functional_currency: 'CHF',
    totals: {
      historical_value: '9400.00',
      current_value: '9500.00',
      unrealized_gain_loss: '100.00',
    },
    items: [
      {
        currency: 'EUR',
        receivables: '12000.00',
        payables: '3000.00',
        bank: '1000.00',
        cash: '0.00',
        net_amount: '10000.00',
        historical_value: '9400.00',
        current_value: '9500.00',
        closing_rate: '0.950000',
        unrealized_gain_loss: '100.00',
        rate_missing: false,
      },
    ],
    ...extra,
  };
}

export function revaluation(id: string, extra: Partial<FxRevaluationRun> = {}): FxRevaluationRun {
  return {
    id,
    status: 'draft',
    period_end: '2026-10-31',
    period_type: 'monthly',
    functional_currency: 'CHF',
    total_gain: '120.00',
    total_loss: '20.00',
    net_result: '100.00',
    journal_entry_id: null,
    reversal_journal_entry_id: null,
    posted_at: null,
    reversed_at: null,
    lines: [
      {
        id: 'l-1',
        line_type: 'receivable',
        currency: 'EUR',
        reference: 'INV-1',
        currency_balance: '1000.00',
        book_value: '940.00',
        closing_rate: '0.950000',
        revalued_value: '950.00',
        difference: '10.00',
        result: 'gain',
        treatment: 'recognise',
      },
      {
        id: 'l-2',
        line_type: 'payable',
        currency: 'USD',
        reference: null,
        currency_balance: '-500.00',
        book_value: '-450.00',
        closing_rate: '0.920000',
        revalued_value: '-460.00',
        difference: '-10.00',
        result: 'loss',
        treatment: 'recognise',
      },
    ],
    ...extra,
  };
}

export function translateSpy() {
  return {
    translate: vi.fn((key: string) => key),
    instant: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

/** Providers shared by the currency specs: the API double, the access check, messages, translations and icons. */
export function baseProviders(
  api: unknown,
  message: unknown = { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  canWrite: (module?: string) => boolean = () => true,
) {
  return [
    provideRouter([]),
    { provide: CurrencyApiService, useValue: api },
    { provide: PermissionsService, useValue: { canWrite } },
    { provide: NzMessageService, useValue: message },
    { provide: I18nService, useValue: translateSpy() },
    provideNzIcons(icons),
  ];
}

/** Lets the pending promises and the effects of a component settle. */
export async function settle(fixture: {
  detectChanges: () => void;
  whenStable: () => Promise<unknown>;
}): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}
