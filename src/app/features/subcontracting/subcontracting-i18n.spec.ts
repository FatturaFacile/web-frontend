import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SCT_CAUSALS,
  SCT_CUSTOMS_REGIMES,
  SCT_DEADLINE_STATUSES,
  SCT_DIRECTIONS,
  SCT_EXPORT_FORMATS,
  SCT_MOVEMENT_TYPES,
  SCT_STATUSES,
  SCT_TYPES,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (an enum value, a code the API reports): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'subcontracting.action',
  'subcontracting.causal',
  'subcontracting.customsRegime',
  'subcontracting.deadlineStatus',
  'subcontracting.direction',
  'subcontracting.error',
  'subcontracting.export',
  'subcontracting.hint',
  'subcontracting.message',
  'subcontracting.modal',
  'subcontracting.movementType',
  'subcontracting.status',
  'subcontracting.type',
];

/** Names of the files of the feature that look like a key (`subcontracting.util`, `subcontracting.scss`). */
const FILE_NAMES = ['subcontracting.scss', 'subcontracting.util', 'subcontracting.routes'];

/** The actions that open a drawer or run a step of the workflow, the keys of their button, title, hint and toast. */
const ACTIONS = [
  'confirm',
  'cancel',
  'dispatch',
  'receive',
  'returnUnused',
  'receiveMaterials',
  'produce',
  'deliver',
];
const FLOWS = ['dispatch', 'receive', 'returnUnused', 'receiveMaterials', 'produce', 'deliver'];

/** Codes the UI translates itself and the ones the API reports (`subcontracting.errors`). */
const ERROR_CODES = [
  'generic',
  'partner_not_found',
  'production_order_not_found',
  'production_operation_not_found',
  'bom_not_found',
  'component_without_product',
  'purchase_order_not_found',
  'purchase_order_supplier_mismatch',
  'quantity_must_be_positive',
  'product_not_found',
  'customs_declaration_not_found',
  'no_components',
  'customs_regime_direction_mismatch',
  'warehouse_not_found',
  'invalid_status_transition',
  'cancel_after_movement',
  'dispatch_exceeds_plan',
  'nothing_to_dispatch',
  'ddt_failed',
  'stock_movement_failed',
  'receipt_exceeds_planned',
  'component_not_in_order',
  'consumption_exceeds_held',
  'return_exceeds_held',
  'nothing_to_return',
  'direction_mismatch',
  'invalid_status_for_action',
  'receipt_exceeds_plan',
  'nothing_to_receive',
  'delivery_exceeds_processed',
  'nothing_to_deliver',
];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/subcontracting\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.SUBCONTRACTING[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key) && !FILE_NAMES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `subcontracting.${group}.${value}`);

  return [
    ...values('action', ACTIONS),
    ...values('causal', SCT_CAUSALS),
    ...values('customsRegime', SCT_CUSTOMS_REGIMES),
    ...values('deadlineStatus', SCT_DEADLINE_STATUSES),
    ...values('direction', SCT_DIRECTIONS),
    ...values('error', ERROR_CODES),
    ...values('export', SCT_EXPORT_FORMATS),
    ...values('hint', FLOWS),
    ...values('message', FLOWS),
    ...values('modal', FLOWS),
    ...values('movementType', SCT_MOVEMENT_TYPES),
    ...values('status', SCT_STATUSES),
    ...values('type', SCT_TYPES),
    'NAV.SUBCONTRACTING',
    'NAV.SUBCONTRACTING_DASHBOARD',
    'NAV.SUBCONTRACTING_ORDERS',
    'NAV.SUBCONTRACTING_ORDER_NEW',
    'NAV.SUBCONTRACTING_ORDER_DETAIL',
    'NAV.SUBCONTRACTING_REGISTER',
    'PAGE_TITLE.SUBCONTRACTING_DASHBOARD',
    'PAGE_TITLE.SUBCONTRACTING_ORDERS',
    'PAGE_TITLE.SUBCONTRACTING_ORDER_NEW',
    'PAGE_TITLE.SUBCONTRACTING_ORDER_DETAIL',
    'PAGE_TITLE.SUBCONTRACTING_REGISTER',
  ];
}

describe('subcontracting translations', () => {
  it('finds the keys of the feature', () => {
    const keys = literalKeys();

    expect(keys.length).toBeGreaterThan(100);
    expect(keys).toContain('subcontracting.badge.zeroValue');
    expect(keys).toContain('subcontracting.preview.unitCost');
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
