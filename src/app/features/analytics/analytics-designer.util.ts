import { HttpErrorResponse } from '@angular/common/http';
import {
  AnalyticsCompareMode,
  AnalyticsPeriodPresetKey,
  AnalyticsReportSpec,
  AnalyticsSemanticDataset,
  AnalyticsSemanticDimension,
  AnalyticsSpecFilter,
  AnalyticsSpecSort,
} from '@core';

/** A filter row of the designer form, before it is turned into the filter of the API. */
export interface DesignerFilterRow {
  field: string;
  operator: string;
  value: string;
}

/** The state of the designer form that makes a report specification. */
export interface DesignerState {
  dimensions: string[];
  granularity: string;
  measures: string[];
  filters: DesignerFilterRow[];
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  limit: number | null;
  periodPreset: AnalyticsPeriodPresetKey | null;
  compare: AnalyticsCompareMode;
}

export const PERIOD_PRESETS: AnalyticsPeriodPresetKey[] = [
  'month_to_date',
  'last_month',
  'quarter_to_date',
  'year_to_date',
  'last_30_days',
  'last_12_months',
];

export const COMPARE_MODES: AnalyticsCompareMode[] = ['none', 'previous_period', 'previous_year'];

/** Operators that take no value. */
const NO_VALUE_OPERATORS = ['is_null', 'not_null'];

/** First validation message of a Laravel 422 (or its summary message) so the user sees the real reason. */
export function analyticsErrorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as { message?: unknown; errors?: Record<string, unknown> } | null;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }

  return typeof body?.message === 'string' && body.message !== '' ? body.message : null;
}

export function emptyDesignerState(): DesignerState {
  return {
    dimensions: [],
    granularity: 'month',
    measures: [],
    filters: [],
    sortField: null,
    sortDirection: 'desc',
    limit: null,
    periodPreset: null,
    compare: 'none',
  };
}

/** The key of a dimension entry of a spec without its granularity (`date:month` is `date`). */
export function dimensionKey(entry: string): string {
  return entry.split(':')[0];
}

/** One typed value of a filter from its text: numbers and booleans are not sent as strings. */
function typedValue(text: string, dimension: AnalyticsSemanticDimension | undefined, isMeasure: boolean): unknown {
  const trimmed = text.trim();
  if (isMeasure || dimension?.type === 'number') {
    const number = Number(trimmed);
    return trimmed !== '' && Number.isFinite(number) ? number : trimmed;
  }

  if (dimension?.type === 'boolean') {
    return trimmed === 'true' || trimmed === '1';
  }

  return trimmed;
}

/** The filters of the form as the filters of the spec: `in` and `between` take lists, `is_null` and `not_null` no value. */
export function buildFilters(rows: DesignerFilterRow[], dataset: AnalyticsSemanticDataset | undefined): AnalyticsSpecFilter[] {
  const filters: AnalyticsSpecFilter[] = [];

  for (const row of rows) {
    if (row.field === '' || row.operator === '') {
      continue;
    }

    if (NO_VALUE_OPERATORS.includes(row.operator)) {
      filters.push({ field: row.field, operator: row.operator });
      continue;
    }

    if (row.value.trim() === '') {
      continue;
    }

    const dimension = dataset?.dimensions.find((candidate) => candidate.key === row.field);
    const isMeasure = !dimension && !!dataset?.measures.some((candidate) => candidate.key === row.field);
    const isList = ['in', 'not_in', 'between'].includes(row.operator);
    const value = isList
      ? row.value
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part !== '')
          .map((part) => typedValue(part, dimension, isMeasure))
      : typedValue(row.value, dimension, isMeasure);

    filters.push({ field: row.field, operator: row.operator, value });
  }

  return filters;
}

/** The report specification of the API from the designer form. */
export function buildSpec(state: DesignerState, dataset: AnalyticsSemanticDataset | undefined): AnalyticsReportSpec {
  const dimensions = state.dimensions.map((key) => {
    const dimension = dataset?.dimensions.find((candidate) => candidate.key === key);
    return dimension?.type === 'date' ? `${key}:${state.granularity}` : key;
  });
  const sort: AnalyticsSpecSort[] = state.sortField ? [{ field: state.sortField, direction: state.sortDirection }] : [];
  const spec: AnalyticsReportSpec = { dimensions, measures: state.measures, filters: buildFilters(state.filters, dataset), sort };

  spec.limit = state.limit && state.limit > 0 ? state.limit : null;
  spec.period = dataset?.supports_period && state.periodPreset ? { preset: state.periodPreset } : null;
  spec.compare = state.compare;

  return spec;
}

/** The designer form from a saved specification (the inverse of `buildSpec`; fixed-date periods are not editable here). */
export function stateFromSpec(spec: AnalyticsReportSpec): DesignerState {
  const state = emptyDesignerState();
  const entries = spec.dimensions ?? [];
  const dated = entries.find((entry) => entry.includes(':'));

  state.dimensions = entries.map(dimensionKey);
  state.granularity = dated ? dated.split(':')[1] : 'month';
  state.measures = [...spec.measures];
  state.filters = (spec.filters ?? []).map((filter) => ({
    field: filter.field,
    operator: filter.operator,
    value: Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value ?? ''),
  }));
  state.sortField = spec.sort?.[0]?.field ?? null;
  state.sortDirection = spec.sort?.[0]?.direction ?? 'desc';
  state.limit = spec.limit ?? null;
  state.periodPreset = spec.period?.preset ?? null;
  state.compare = spec.compare ?? 'none';

  return state;
}
