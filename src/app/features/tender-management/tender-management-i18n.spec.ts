import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TND_ALERT_SEVERITIES,
  TND_ALERT_TYPES,
  TND_AWARD_CRITERIA,
  TND_COMPLIANCE_CODES,
  TND_DECISIONS,
  TND_ENVELOPES,
  TND_ERROR_CODES,
  TND_FORMULA_TYPES,
  TND_ITEM_STATUSES,
  TND_JURISDICTIONS,
  TND_NOTICE_STATUSES,
  TND_PARTICIPATION_MODES,
  TND_PARTICIPATION_STATUSES,
  TND_PARTNER_ROLES,
  TND_PROCEDURE_TYPES,
  TND_SIGNATURE_FORMATS,
  TND_SIGNATURE_STATUSES,
  TND_VAULT_DOC_TYPES,
  TND_VERIFICATION_STATUSES,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value: derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'tenderManagement.compliance',
  'tenderManagement.criterion',
  'tenderManagement.enum.alertSeverity',
  'tenderManagement.enum.alertType',
  'tenderManagement.enum.awardCriterion',
  'tenderManagement.enum.decision',
  'tenderManagement.enum.envelope',
  'tenderManagement.enum.formulaType',
  'tenderManagement.enum.itemStatus',
  'tenderManagement.enum.jurisdiction',
  'tenderManagement.enum.participationMode',
  'tenderManagement.enum.participationStatus',
  'tenderManagement.enum.partnerRole',
  'tenderManagement.enum.procedureType',
  'tenderManagement.enum.signatureFormat',
  'tenderManagement.enum.signatureStatus',
  'tenderManagement.enum.vaultDocType',
  'tenderManagement.enum.verificationStatus',
  'tenderManagement.envelopeItem',
  'tenderManagement.error',
  'tenderManagement.matrix.categories',
  'tenderManagement.offer.reduction',
  'tenderManagement.vault',
  'tenderManagement.vault.modal',
  'tenderManagement.vault.soaMilestone',
  'tenderManagement.view',
];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/tenderManagement\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.TENDER_MANAGEMENT[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `tenderManagement.${group}.${value}`);

  return [
    ...values('enum.jurisdiction', TND_JURISDICTIONS),
    ...values('enum.procedureType', TND_PROCEDURE_TYPES),
    ...values('enum.awardCriterion', TND_AWARD_CRITERIA),
    ...values('enum.formulaType', TND_FORMULA_TYPES),
    ...values('enum.noticeStatus', TND_NOTICE_STATUSES),
    ...values('enum.participationMode', TND_PARTICIPATION_MODES),
    ...values('enum.participationStatus', TND_PARTICIPATION_STATUSES),
    ...values('enum.verificationStatus', TND_VERIFICATION_STATUSES),
    ...values('enum.vaultDocType', TND_VAULT_DOC_TYPES),
    ...values('enum.envelope', TND_ENVELOPES),
    ...values('enum.alertSeverity', TND_ALERT_SEVERITIES),
    ...values('enum.alertType', TND_ALERT_TYPES),
    ...values('enum.decision', TND_DECISIONS),
    ...values('enum.signatureStatus', TND_SIGNATURE_STATUSES),
    ...values('enum.signatureFormat', TND_SIGNATURE_FORMATS),
    ...values('enum.itemStatus', TND_ITEM_STATUSES),
    ...values('enum.partnerRole', TND_PARTNER_ROLES),
    ...values('error', [...TND_ERROR_CODES, 'generic']),
    ...values('compliance', TND_COMPLIANCE_CODES),
    ...values('alert', TND_ALERT_TYPES),
    ...values('matrix.categories', ['financial', 'technical', 'qualification', 'certification', 'compliance']),
    ...values('criterion', ['turnover', 'similar_projects', 'soa']),
    ...values('offer.reduction', ['pmi', 'iso9001', 'emas', 'iso14001', 'pdr125']),
    ...values('vault', ['IT', 'CH']),
    ...values('vault.modal', ['create', 'edit', 'renew']),
    ...values('vault.soaMilestone', ['intermediate_check', 'expiry']),
    ...values('view', ['kanban', 'list']),
    'NAV.TENDER_MANAGEMENT',
    'NAV.TENDER_MANAGEMENT_PIPELINE',
    'NAV.TENDER_MANAGEMENT_DETAIL',
    'NAV.TENDER_MANAGEMENT_VAULT',
    'NAV.TENDER_MANAGEMENT_BENCHMARKS',
    'PAGE_TITLE.TENDER_MANAGEMENT_PIPELINE',
    'PAGE_TITLE.TENDER_MANAGEMENT_DETAIL',
    'PAGE_TITLE.TENDER_MANAGEMENT_VAULT',
    'PAGE_TITLE.TENDER_MANAGEMENT_BENCHMARKS',
  ];
}

describe('tender management translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('tenderManagement.field.submissionDeadline');
    expect(literalKeys()).toContain('PAGE_TITLE.TENDER_MANAGEMENT_VAULT');
    expect(literalKeys().length).toBeGreaterThan(100);
  });

  it('never falls back to a text written in the sources', () => {
    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
        continue;
      }
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
