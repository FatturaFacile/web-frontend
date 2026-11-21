import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';
import { EXEC_DSS_KEYS } from './dss-keys';
import { overviewFixture } from './dss.testing';
import { COMPARISON_BASELINES, PERIOD_PRESETS, SCENARIO_RANGES } from './dss.utils';

const root = resolve(process.cwd(), 'src/app');
const dss = join(root, 'features/analytics/dss');
const files = [
  ...readdirSync(dss)
    .filter((name) => /\.ts$/.test(name) && !name.endsWith('.spec.ts') && name !== 'dss-keys.ts')
    .map((name) => join(dss, name)),
  join(root, 'features/analytics/analytics.routes.ts'),
  join(root, 'layout/sidebar/menu-sections.ts'),
];

/** The keys the sources write out in full. */
function literalKeys(): string[] {
  const found = new Set<string>();

  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(/'(EXEC_DSS\.[A-Z0-9_]*[A-Z0-9])'/g)) {
      found.add(match[1]);
    }
  }

  return [...found].sort();
}

/** The keys the templates build from a closed list (`'EXEC_DSS.KPI_' + key.toUpperCase()` and the like). */
function composedKeys(): string[] {
  const upper = (prefix: string, values: readonly string[]): string[] =>
    values.map((value) => `EXEC_DSS.${prefix}${value.toUpperCase()}`);
  const scorecard = overviewFixture().scorecard;
  const kpis = [...scorecard.financial, ...scorecard.customer, ...scorecard.efficiency].map(
    (kpi) => kpi.key,
  );

  return [
    ...upper('KPI_', kpis),
    ...upper('GROUP_', ['financial', 'customer', 'efficiency']),
    ...upper('SEVERITY_', ['CRITICAL', 'WARNING', 'INFO']),
    ...upper('ALERT_', [
      'margin_erosion',
      'dso_spike',
      'customer_concentration',
      'budget_overrun',
      'statistical_outlier',
    ]),
    ...upper('STEP_', ['baseline', 'volume', 'price', 'cogs', 'opex', 'fx', 'actual']),
    ...upper('DIM_', ['customer', 'product', 'channel', 'cost_center', 'legal_entity']),
    ...upper('SIM_', Object.keys(SCENARIO_RANGES)),
    ...upper('SIM_', ['ebitda', 'net_cash_flow', 'break_even']),
    ...upper('METRIC_', [
      'revenue',
      'cogs',
      'opex',
      'depreciation',
      'cash',
      'receivable',
      'payable',
      'inventory',
    ]),
    ...upper('PERIOD_', PERIOD_PRESETS),
    ...upper('BASELINE_', COMPARISON_BASELINES),
  ];
}

describe('Executive DSS translation keys', () => {
  it('lists every key the sources write out in full', () => {
    const missing = literalKeys().filter((key) => !EXEC_DSS_KEYS.includes(key));

    expect(missing).toEqual([]);
  });

  it('lists every key the templates compose from a closed list', () => {
    expect(composedKeys().filter((key) => !EXEC_DSS_KEYS.includes(key))).toEqual([]);
  });

  it('has no duplicate and no key that nothing uses', () => {
    const used = new Set([...literalKeys(), ...composedKeys()]);

    expect(new Set(EXEC_DSS_KEYS).size).toBe(EXEC_DSS_KEYS.length);
    expect(EXEC_DSS_KEYS.filter((key) => !used.has(key))).toEqual([]);
  });
});

describe.skipIf(!hasSeededDictionaries)('Executive DSS seeded translations', () => {
  for (const language of SEEDED_LANGUAGES) {
    it(`${language} has every key`, () => {
      const dictionary = seededDictionaries[language] ?? {};

      expect(EXEC_DSS_KEYS.filter((key) => !(key in dictionary))).toEqual([]);
    });
  }

  it('every language keeps the placeholders of the English text', () => {
    const placeholders = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const english = seededDictionaries['en'] ?? {};
    const broken: string[] = [];

    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};

      for (const key of EXEC_DSS_KEYS) {
        if (
          placeholders(dictionary[key] ?? '').join() !== placeholders(english[key] ?? '').join()
        ) {
          broken.push(`${language}:${key}`);
        }
      }
    }

    expect(broken).toEqual([]);
  });
});
