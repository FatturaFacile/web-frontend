import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { COMPARISONS, PRESETS } from './kpi-filter-bar.component';
import { ROLE_CODES } from './kpi-dashboards.models';
import {
  BUCKET_KEYS,
  bucketKey,
  kpiDescriptionKey,
  kpiTitleKey,
  presetKey,
} from './kpi-dashboards.utils';

const FEATURE_DIR = __dirname;

const KPI_CODES = [
  'revenue_ytd_vs_budget',
  'ebitda',
  'net_financial_position',
  'order_backlog',
  'headcount_fte',
  'dso',
  'dpo',
  'net_working_capital',
  'cash_runway',
  'ar_ap_aging',
  'vat_liability',
  'weighted_pipeline',
  'win_rate',
  'gross_margin',
  'top_customers',
  'top_products',
  'inventory_turnover',
  'otif',
  'oee',
  'scrap_rate',
  'headcount_turnover',
  'absenteeism',
  'overtime_trend',
  'billable_utilization',
];

const WATERFALL_STEPS = [
  'revenue',
  'cogs',
  'opex',
  'ebitda',
  'receivables',
  'inventory',
  'payables',
  'net_working_capital',
  'available_time',
  'availability_loss',
  'performance_loss',
  'quality_loss',
  'oee',
];

/** Keys written in full in the sources of the feature (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }

    for (const match of readFileSync(join(FEATURE_DIR, file), 'utf8').matchAll(
      /KPI_DASHBOARDS\.[A-Z0-9_]+/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !key.endsWith('_'));
}

/** Keys the code builds from a value (KPI codes, buckets, presets, comparison modes, roles, waterfall steps). */
function familyKeys(): string[] {
  return [
    ...KPI_CODES.flatMap((code) => [kpiTitleKey(code), kpiDescriptionKey(code)]),
    ...BUCKET_KEYS.map((bucket) => bucketKey(bucket)),
    ...PRESETS.map((preset) => presetKey(preset)),
    ...COMPARISONS.map((mode) => `KPI_DASHBOARDS.COMPARE_${mode.toUpperCase()}`),
    ...ROLE_CODES.map((role) => `KPI_DASHBOARDS.DASHBOARD_${role.toUpperCase()}`),
    ...WATERFALL_STEPS.map((step) => `KPI_DASHBOARDS.STEP_${step.toUpperCase()}`),
  ];
}

describe('KPI dashboards translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('KPI_DASHBOARDS.TITLE');
    expect(literalKeys().length).toBeGreaterThan(20);
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every key in it, en, de and fr with a non-empty text',
    () => {
      const keys = [...new Set([...literalKeys(), ...familyKeys()])];

      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');

        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );

  it.skipIf(!hasSeededDictionaries)('uses the same placeholders in every language', () => {
    const placeholders = (text: string): string =>
      [...text.matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(',');

    for (const key of [...new Set([...literalKeys(), ...familyKeys()])]) {
      const variants = new Set(
        SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')),
      );

      expect(variants.size, `${key} has different placeholders per language`).toBe(1);
    }
  });
});
