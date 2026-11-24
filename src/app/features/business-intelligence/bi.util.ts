import { HttpErrorResponse } from '@angular/common/http';
import { BiDataset, BiDimension, BiMeasureUnit, BiQueryColumn, BiQueryResult, BiSpec } from '@core';

/** First validation message of a Laravel 422 (or its summary message) so the user sees the real reason. */
export function apiErrorText(error: unknown): string | null {
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

/** An empty text input is sent to the API as null. */
export function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** The key of a dimension entry of a spec without its granularity (`date:month` is `date`). */
export function dimensionKey(entry: string): string {
  return entry.split(':')[0];
}

export function specDimensionKeys(spec: BiSpec | null | undefined): string[] {
  return (spec?.dimensions ?? []).map(dimensionKey);
}

export function findDimension(dataset: BiDataset | undefined, key: string): BiDimension | undefined {
  return dataset?.dimensions.find((dimension) => dimension.key === key);
}

/** Dimensions a drill path can use: every dimension except the dates, which have no single value to filter on. */
export function drillableDimensions(dataset: BiDataset | undefined): BiDimension[] {
  return (dataset?.dimensions ?? []).filter((dimension) => dimension.type !== 'date');
}

/** A figure of the API (decimal string or integer) as a number for charts and totals. */
export function toNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(number) ? number : 0;
}

/** A figure formatted for the screen with the decimals of its unit. */
export function formatBiValue(value: unknown, unit: BiMeasureUnit | undefined | null): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const digits = unit === 'count' ? 0 : unit === 'quantity' ? 4 : 2;
  const text = new Intl.NumberFormat(undefined, { minimumFractionDigits: unit === 'quantity' ? 0 : digits, maximumFractionDigits: digits }).format(toNumber(value));

  return unit === 'percent' ? `${text} %` : text;
}

export function firstDimension(result: BiQueryResult): BiQueryColumn | undefined {
  return result.columns.find((column) => column.kind === 'dimension');
}

export function firstMeasure(result: BiQueryResult): BiQueryColumn | undefined {
  return result.columns.find((column) => column.kind === 'measure');
}

export interface BiChartPoint {
  label: string;
  value: number;
  /** Raw dimension value, null for the empty bucket: what a drill-down filters on. */
  raw: string | null;
}

/** The points of a chart: the first dimension against the first measure of a result. */
export function chartPoints(result: BiQueryResult | null | undefined): BiChartPoint[] {
  if (!result) {
    return [];
  }

  const dimension = firstDimension(result);
  const measure = firstMeasure(result);
  if (!measure) {
    return [];
  }

  return result.rows.map((row) => {
    const raw = dimension ? (row[dimension.key] ?? null) : null;
    return { label: raw === null ? '-' : String(raw), value: toNumber(row[measure.key]), raw: raw === null ? null : String(raw) };
  });
}

/** Operators of a filter, with the translation key of their label. */
export const BI_OPERATOR_KEYS: Readonly<Record<string, string>> = {
  eq: 'BI.OP_EQ',
  neq: 'BI.OP_NEQ',
  gt: 'BI.OP_GT',
  gte: 'BI.OP_GTE',
  lt: 'BI.OP_LT',
  lte: 'BI.OP_LTE',
  between: 'BI.OP_BETWEEN',
  in: 'BI.OP_IN',
  not_in: 'BI.OP_NOT_IN',
  contains: 'BI.OP_CONTAINS',
  starts_with: 'BI.OP_STARTS_WITH',
  is_null: 'BI.OP_IS_NULL',
  not_null: 'BI.OP_NOT_NULL',
};

export const VISIBILITY_COLORS: Readonly<Record<string, string>> = {
  private: 'default',
  shared: 'blue',
  company: 'green',
};
