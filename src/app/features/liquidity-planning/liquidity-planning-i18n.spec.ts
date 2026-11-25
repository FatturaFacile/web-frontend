import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import {
  LP_ALERT_STATUSES,
  LP_FREQUENCIES,
  LP_ITEM_CATEGORIES,
  LP_LEVER_SPECS,
  LP_TIERS,
} from './liquidity-planning.util';

/** Prefixes the code completes with a value: derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'lp.dscr.status',
  'lp.dscr.kind',
  'lp.pfn.status',
  'lp.capital.regime',
  'lp.capital.status',
  'lp.liquidity.status',
  'lp.tier',
  'lp.unit',
  'lp.lever',
  'lp.alerts.status',
  'lp.alerts.severity',
  'lp.report.status',
  'lp.settings',
  'lp.settings.jurisdictionValue',
  'lp.items.direction',
  'lp.items.frequency',
  'lpApi.category',
];

/** Sources of the workspace, not the specs and not the fixtures (which carry API-owned sample keys). */
function sources(): string[] {
  return readdirSync(__dirname).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.fixtures.ts'),
  );
}

function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of sources()) {
    for (const match of readFileSync(join(__dirname, file), 'utf8').matchAll(
      /\b(?:lp|lpApi)\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

function derivedKeys(): string[] {
  const values = (prefix: string, list: readonly string[]) =>
    list.map((value) => `${prefix}.${value}`);

  return [
    ...values('lp.dscr.status', ['critical', 'warning', 'healthy', 'not_applicable']),
    ...values('lp.dscr.kind', ['operating_inflow', 'operating_outflow', 'principal', 'interest']),
    ...values('lp.pfn.status', ['ok', 'watch', 'breach', 'not_applicable']),
    ...values('lp.capital.regime', ['CH_CO_725', 'IT_CC_2446_2447']),
    ...values('lp.capital.status', [
      'ok',
      'watch',
      'half_capital_lost',
      'below_legal_minimum',
      'over_indebted',
    ]),
    ...values('lp.liquidity.status', ['ok', 'watch', 'negative']),
    ...values('lp.tier', LP_TIERS),
    ...values('lp.unit', ['days', 'percent', 'amount']),
    ...values('lp.lever', [...LP_LEVER_SPECS.map((spec) => spec.key), 'additional_financing_date']),
    ...values('lp.alerts.status', LP_ALERT_STATUSES),
    ...values('lp.alerts.severity', ['info', 'warning', 'critical']),
    ...values('lp.report.status', ['ok', 'watch', 'critical']),
    ...values('lp.settings.jurisdictionValue', ['CH', 'IT']),
    ...values('lp.settings', [
      'share_capital',
      'legal_minimum_capital',
      'minimum_liquidity',
      'dscr_critical_threshold',
      'dscr_warning_threshold',
      'max_pfn_ebitda',
      'ebitda_override',
      'net_equity_override',
      'payroll_monthly_override',
      'tax_monthly_estimate',
      'alert_cooldown_hours',
      'collection_behavior_days',
      'payroll_pay_day',
      'notify_emails',
      'email_alerts_enabled',
    ]),
    ...values('lp.items.direction', ['inflow', 'outflow']),
    ...values('lp.items.frequency', LP_FREQUENCIES),
    ...values('lpApi.category', LP_ITEM_CATEGORIES),
    'NAV.LIQUIDITY_PLANNING',
    'NAV.LIQUIDITY_PLANNING_REPORT',
    'PAGE_TITLE.LIQUIDITY_PLANNING',
    'PAGE_TITLE.LIQUIDITY_PLANNING_REPORT',
  ];
}

describe('liquidity planning translations', () => {
  it('finds the keys of the workspace', () => {
    expect(literalKeys()).toContain('lp.title');
    expect(literalKeys()).toContain('lp.whatIf.apply');
    expect(literalKeys().length).toBeGreaterThan(100);
  });

  it('never writes a text, or a fallback, in the sources', () => {
    for (const file of sources()) {
      expect(readFileSync(join(__dirname, file), 'utf8'), file).not.toMatch(/translateOr\(/);
    }
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every key in it, en, de and fr with a non-empty text',
    () => {
      const keys = [...new Set([...literalKeys(), ...derivedKeys()])];

      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');

        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );
});
