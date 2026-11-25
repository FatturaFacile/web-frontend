import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INVOICE_MATCH_STATUSES } from '@domain/procurement/invoice-matching.models';
import {
  DOCUMENT_FLOW_ENTRY_TYPES,
  SUPPLIER_RATING_COMPONENTS,
} from '@domain/procurement/srm.models';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';
import {
  APPROVAL_STATUSES,
  KNOWN_DOCUMENT_TYPES,
  PAYMENT_STATUSES,
} from '../../purchases/invoice-detail/supplier-invoice-detail.helpers';
import { KNOWN_FLOW_STATUSES } from './srm.helpers';

const FEATURE_DIR = __dirname;
const PROCUREMENT_DIR = join(__dirname, '..');
const INVOICE_DETAIL_DIR = join(__dirname, '..', '..', 'purchases', 'invoice-detail');
const MENU_FILE = join(__dirname, '..', '..', '..', 'layout', 'sidebar', 'menu-sections.ts');

const QUALIFICATION_STATUSES = [
  'prospect',
  'in_qualification',
  'qualified',
  'conditional',
  'preferred',
  'expired',
  'suspended',
  'disqualified',
  'blacklisted',
] as const;

const RELATIONS = [
  'sourced_by',
  'awarded_to',
  'converted_to',
  'called_off_by',
  'received_by',
  'matched_by',
  'invoiced_by',
  'returned_by',
  'credited_by',
] as const;

/** Keys that are assembled from a domain list at runtime (`srm.tier.` + tier, ...). */
function dynamicKeys(): string[] {
  return [
    ...['A', 'B', 'C', 'D'].map((tier) => `srm.tier.${tier}`),
    ...SUPPLIER_RATING_COMPONENTS.map((component) => `srm.component.${component}`),
    ...[...DOCUMENT_FLOW_ENTRY_TYPES, 'framework_agreement'].map((type) => `srm.flow.type.${type}`),
    ...RELATIONS.map((relation) => `srm.flow.relation.${relation}`),
    ...KNOWN_FLOW_STATUSES.map((status) => `srm.flow.status.${status}`),
    ...QUALIFICATION_STATUSES.map((status) => `srm.qualification.${status}`),
    ...INVOICE_MATCH_STATUSES.map((status) => `invoiceMatching.status.${status}`),
    ...PAYMENT_STATUSES.map((status) => `srm.invoice.payment.${status}`),
    ...APPROVAL_STATUSES.map((status) => `srm.invoice.approval.${status}`),
    ...KNOWN_DOCUMENT_TYPES.map((code) => `srm.invoice.documentType.${code}`),
  ];
}

/** Every SRM key referenced by the feature files, the routes and the menu. */
function collectedKeys(): string[] {
  const keys = new Set<string>(dynamicKeys());
  const pattern = /srm\.[A-Za-z0-9_.]+|(?:NAV|PAGE_TITLE)\.PROCUREMENT_SRM[A-Z_]*/g;

  const files = [
    ...[FEATURE_DIR, INVOICE_DETAIL_DIR].flatMap((dir) =>
      readdirSync(dir)
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
        .map((file) => join(dir, file)),
    ),
    join(PROCUREMENT_DIR, 'procurement.routes.ts'),
    MENU_FILE,
  ];

  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !key.endsWith('_') && !key.endsWith('.'));
}

describe('Purchasing and SRM translations', () => {
  it('collects the keys of templates, helpers, routes and menu', () => {
    const keys = collectedKeys();

    expect(keys).toContain('NAV.PROCUREMENT_SRM');
    expect(keys).toContain('NAV.PROCUREMENT_SRM_SCORECARDS');
    expect(keys).toContain('PAGE_TITLE.PROCUREMENT_SRM');
    expect(keys).toContain('srm.dashboard.title');
    expect(keys).toContain('srm.kpi.blockedInvoices');
    expect(keys).toContain('srm.flow.relation.matched_by');
    expect(keys).toContain('srm.flow.status.blocked_discrepancy');
    expect(keys).toContain('srm.component.rfq_responsiveness_rate');
    expect(keys).toContain('srm.invoice.field.withholding');
    expect(keys).toContain('srm.invoice.documentType.TD04');
    expect(keys.length).toBeGreaterThan(100);
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every key in it, en, de and fr with non-empty text',
    () => {
      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = collectedKeys().filter((key) => (dictionary[key] ?? '').trim() === '');
        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );
});
