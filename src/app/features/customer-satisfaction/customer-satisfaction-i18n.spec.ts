import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CS_BANDS,
  CS_CHANNELS,
  CS_CHURN_RISKS,
  CS_DISPATCH_STATUSES,
  CS_GRANULARITIES,
  CS_GROUP_BY,
  CS_RECOVERY_PRIORITIES,
  CS_RECOVERY_STATUSES,
  CS_REPORT_FORMATS,
  CS_SENTIMENT_LABELS,
  CS_SURVEY_TYPES,
  CS_THROTTLE_REASONS,
  CS_TRIGGER_EVENTS,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (an enum value, a code the API reports): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'customerSatisfaction.band',
  'customerSatisfaction.channel',
  'customerSatisfaction.churn',
  'customerSatisfaction.dimension',
  'customerSatisfaction.dispatchStatus',
  'customerSatisfaction.error',
  'customerSatisfaction.export',
  'customerSatisfaction.followUp',
  'customerSatisfaction.granularity',
  'customerSatisfaction.priority',
  'customerSatisfaction.public.pickScore',
  'customerSatisfaction.recoveryStatus',
  'customerSatisfaction.rootCause',
  'customerSatisfaction.sentiment',
  'customerSatisfaction.submittedVia',
  'customerSatisfaction.surveyType',
  'customerSatisfaction.throttleReason',
  'customerSatisfaction.topic',
  'customerSatisfaction.trigger',
];

/** Codes the UI translates itself and the ones the API reports (`customer_satisfaction.errors`). */
const ERROR_CODES = [
  'generic',
  'microphone_unavailable',
  'survey_not_found',
  'survey_expired',
  'survey_not_available',
  'invalid_score',
  'score_required',
  'comment_required',
  'voice_not_allowed',
  'invalid_status_transition',
  'resolution_requires_root_cause',
  'unsupported_export_format',
];

const ROOT_CAUSES = [
  'product_defect',
  'delivery_delay',
  'service_quality',
  'billing_error',
  'communication',
  'pricing',
  'staff_behaviour',
  'process_complexity',
  'other',
];

const TOPICS = ['delivery', 'price', 'support', 'quality', 'speed', 'communication', 'staff'];
const SUBMITTED_VIA = ['one_click_link', 'landing_page', 'whatsapp_reply', 'portal'];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/customerSatisfaction\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.CUSTOMER_SATISFACTION[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `customerSatisfaction.${group}.${value}`);

  return [
    ...values('band', CS_BANDS),
    ...values('channel', CS_CHANNELS),
    ...values('churn', CS_CHURN_RISKS),
    ...values('dimension', CS_GROUP_BY),
    ...values('dispatchStatus', CS_DISPATCH_STATUSES),
    ...values('error', ERROR_CODES),
    ...values('export', CS_REPORT_FORMATS),
    ...values('followUp', ['low', 'mid', 'high']),
    ...values('granularity', CS_GRANULARITIES),
    ...values('priority', CS_RECOVERY_PRIORITIES),
    ...values('public.pickScore', CS_SURVEY_TYPES),
    ...values('recoveryStatus', CS_RECOVERY_STATUSES),
    ...values('rootCause', ROOT_CAUSES),
    ...values('sentiment', CS_SENTIMENT_LABELS),
    ...values('submittedVia', SUBMITTED_VIA),
    ...values('surveyType', CS_SURVEY_TYPES),
    ...values('throttleReason', CS_THROTTLE_REASONS),
    ...values('topic', TOPICS),
    ...values('trigger', CS_TRIGGER_EVENTS),
    'customerSatisfaction.notification.detractor_recovery_opened',
    'NAV.CUSTOMER_SATISFACTION',
    'NAV.CUSTOMER_SATISFACTION_DASHBOARD',
    'NAV.CUSTOMER_SATISFACTION_RECOVERY',
    'NAV.CUSTOMER_SATISFACTION_TEMPLATES',
    'NAV.CUSTOMER_SATISFACTION_DISPATCHES',
    'PAGE_TITLE.CUSTOMER_SATISFACTION_DASHBOARD',
    'PAGE_TITLE.CUSTOMER_SATISFACTION_RECOVERY',
    'PAGE_TITLE.CUSTOMER_SATISFACTION_TEMPLATES',
    'PAGE_TITLE.CUSTOMER_SATISFACTION_DISPATCHES',
    'PAGE_TITLE.CUSTOMER_SATISFACTION_SURVEY',
  ];
}

describe('customer satisfaction translations', () => {
  it('finds the keys of the feature', () => {
    const keys = literalKeys();

    expect(keys.length).toBeGreaterThan(100);
    expect(keys).toContain('customerSatisfaction.public.recorded');
    expect(keys).toContain('customerSatisfaction.kpi.slaCompliance');
    expect(new Set(derivedKeys()).size).toBe(derivedKeys().length);
  });

  it('adds no string to the frontend: the sources of the feature carry no dictionary', () => {
    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
        continue;
      }
      const source = readFileSync(join(__dirname, file), 'utf8');

      expect(source, file).not.toMatch(/translations?\s*[:=]\s*\{\s*['"]?(it|en|de|fr)['"]?\s*:/);
    }
  });

  for (const language of SEEDED_LANGUAGES) {
    it.skipIf(!hasSeededDictionaries)(`has every key in the seeded ${language} dictionary`, () => {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = [...literalKeys(), ...derivedKeys()].filter(
        (key) => !(key in dictionary) || dictionary[key].trim() === '',
      );

      expect(missing).toEqual([]);
    });
  }
});
