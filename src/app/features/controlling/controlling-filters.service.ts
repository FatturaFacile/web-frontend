import { computed, Service, signal } from '@angular/core';
import { CompareMode, MarginQuery, MarginTier } from '@core';

export const PERIOD_PRESETS = [
  'this_month',
  'last_quarter',
  'ytd',
  'last_12_months',
  'custom',
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type FacetKey =
  | 'cost_center_id'
  | 'job_id'
  | 'country_code'
  | 'product_family_id'
  | 'customer_id'
  | 'sales_agent_id'
  | 'production_department_id';

function iso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Period of a preset relative to today. */
export function presetRange(
  preset: PeriodPreset,
  today = new Date(),
): { from: string; to: string } {
  const year = today.getFullYear();
  const month = today.getMonth();
  switch (preset) {
    case 'this_month':
      return { from: iso(new Date(year, month, 1)), to: iso(new Date(year, month + 1, 0)) };
    case 'last_quarter': {
      const quarterStart = Math.floor(month / 3) * 3 - 3;
      return {
        from: iso(new Date(year, quarterStart, 1)),
        to: iso(new Date(year, quarterStart + 3, 0)),
      };
    }
    case 'last_12_months':
      return { from: iso(new Date(year, month - 11, 1)), to: iso(new Date(year, month + 1, 0)) };
    default:
      return { from: iso(new Date(year, 0, 1)), to: iso(today) };
  }
}

/** The global control bar state shared by the five workspace views: period, comparison, margin tier and facets. */
@Service()
export class ControllingFilters {
  readonly preset = signal<PeriodPreset>('ytd');
  readonly dateFrom = signal(presetRange('ytd').from);
  readonly dateTo = signal(presetRange('ytd').to);
  readonly compareMode = signal<CompareMode>('prior_year');
  readonly tier = signal<MarginTier>('gross');
  readonly facets = signal<Partial<Record<FacetKey, string>>>({});

  readonly fiscalYear = computed(() => Number(this.dateTo().slice(0, 4)));
  readonly lastMonth = computed(() => Number(this.dateTo().slice(5, 7)));

  readonly query = computed<MarginQuery>(() => ({
    date_from: this.dateFrom(),
    date_to: this.dateTo(),
    margin_tier: this.tier(),
    compare_mode: this.compareMode(),
    ...this.facets(),
  }));

  applyPreset(preset: PeriodPreset): void {
    this.preset.set(preset);
    if (preset !== 'custom') {
      const range = presetRange(preset);
      this.dateFrom.set(range.from);
      this.dateTo.set(range.to);
    }
  }

  setRange(from: string, to: string): void {
    this.preset.set('custom');
    this.dateFrom.set(from);
    this.dateTo.set(to);
  }

  setFacet(key: FacetKey, value: string | null): void {
    this.facets.update((current) => {
      const next = { ...current };
      if (value === null || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }
}
