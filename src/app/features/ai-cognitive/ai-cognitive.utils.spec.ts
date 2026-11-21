import { describe, expect, it } from 'vitest';
import { suggestionFixture } from './ai-cognitive.testing';
import {
  actionRoute,
  ALL_KINDS,
  bandColor,
  coerceInput,
  confidenceBand,
  entityRoute,
  isDraftKind,
  isEdited,
  isInsightKind,
  isOpen,
  percent,
  policyOutcome,
  scalarEntries,
  withCell,
  withField,
} from './ai-cognitive.utils';

const rule = {
  is_enabled: true,
  auto_approve_enabled: true,
  auto_approve_min_confidence: 0.95,
  max_auto_amount: 1000,
};

describe('confidence bands', () => {
  it('shows 90% and above as high, 70% and above as medium and the rest as low', () => {
    expect(confidenceBand(0.99)).toBe('high');
    expect(confidenceBand(0.9)).toBe('high');
    expect(confidenceBand(0.89)).toBe('medium');
    expect(confidenceBand(0.7)).toBe('medium');
    expect(confidenceBand(0.69)).toBe('low');
    expect(confidenceBand(0)).toBe('low');
  });

  it('colours the bands green, amber and red and writes a score as a percentage', () => {
    expect(bandColor('high')).toBe('green');
    expect(bandColor('medium')).toBe('gold');
    expect(bandColor('low')).toBe('red');
    expect(percent(0.956)).toBe('96%');
  });
});

describe('policy outcome (zero-click approval or review)', () => {
  it('approves automatically at or above the threshold and below the amount limit', () => {
    expect(policyOutcome(rule, 0.95, 999.99)).toBe('auto');
    expect(policyOutcome(rule, 0.99, 200)).toBe('auto');
  });

  it('sends to review below the threshold, at the amount limit or when automatic approval is off', () => {
    expect(policyOutcome(rule, 0.94, 200)).toBe('review');
    expect(policyOutcome(rule, 0.99, 1000)).toBe('review');
    expect(policyOutcome(rule, 0.99, 5000)).toBe('review');
    expect(policyOutcome({ ...rule, auto_approve_enabled: false }, 1, 1)).toBe('review');
  });

  it('has no amount limit when none is set and ignores the amount of a result that has none', () => {
    expect(policyOutcome({ ...rule, max_auto_amount: null }, 0.97, 1_000_000)).toBe('auto');
    expect(policyOutcome(rule, 0.97, null)).toBe('auto');
  });

  it('is off when the workflow is switched off, whatever the confidence', () => {
    expect(policyOutcome({ ...rule, is_enabled: false }, 1, 1)).toBe('off');
  });
});

describe('payload editing', () => {
  const payload = { currency: 'CHF', notes: null, items: [{ description: 'Chair', quantity: 2 }] };

  it('changes one field or one cell and leaves the original alone', () => {
    const changed = withField(payload, 'currency', 'EUR');
    const cell = withCell(payload, 'items', 0, 'quantity', 3);

    expect(changed['currency']).toBe('EUR');
    expect(payload.currency).toBe('CHF');
    expect(cell['items']).toEqual([{ description: 'Chair', quantity: 3 }]);
    expect(payload.items[0]?.quantity).toBe(2);
  });

  it('knows whether the reviewer changed anything', () => {
    expect(isEdited(payload, { ...payload })).toBe(false);
    expect(isEdited(payload, withField(payload, 'notes', 'x'))).toBe(true);
    expect(isEdited(payload, withCell(payload, 'items', 0, 'quantity', 2))).toBe(false);
  });

  it('keeps the type of what an input edits: numbers stay numbers, an empty input is null', () => {
    expect(coerceInput(2, '3.5')).toBe(3.5);
    expect(coerceInput(2, 'abc')).toBe(2);
    expect(coerceInput('CHF', 'EUR')).toBe('EUR');
    expect(coerceInput(2, '  ')).toBeNull();
    expect(coerceInput(null, 'text')).toBe('text');
  });

  it('lists the plain values of a payload for the summary of an alert', () => {
    expect(
      scalarEntries({ rule: 'iban_change', details: { a: 1 }, n: 3, ok: true, none: null }),
    ).toEqual([
      ['rule', 'iban_change'],
      ['n', 3],
      ['ok', true],
    ]);
  });
});

describe('kinds and routes', () => {
  it('separates the drafts that create a record from the insights and the rest', () => {
    expect(ALL_KINDS).toHaveLength(11);
    expect(isDraftKind('sales_quote')).toBe(true);
    expect(isDraftKind('anomaly')).toBe(false);
    expect(isInsightKind('reorder')).toBe(true);
    expect(isInsightKind('contact')).toBe(false);
  });

  it('keeps pending and failed items open', () => {
    expect(isOpen('pending')).toBe(true);
    expect(isOpen('failed')).toBe(true);
    expect(isOpen('approved')).toBe(false);
    expect(isOpen('auto_approved')).toBe(false);
  });

  it('leads to the record a decision produced and to the subject of an alert', () => {
    expect(entityRoute('quotes', 'q-1')).toBe('/quotes/q-1');
    expect(entityRoute('contacts', 'c-1')).toBe('/contacts/c-1');
    expect(entityRoute('bank_transactions', 'b-1')).toBeNull();
    expect(entityRoute(null, null)).toBeNull();

    expect(
      actionRoute(
        suggestionFixture({ kind: 'late_payment_risk', proposed_payload: { customer_id: 'c-9' } }),
      ),
    ).toBe('/contacts/c-9');
    expect(
      actionRoute(
        suggestionFixture({
          kind: 'anomaly',
          proposed_payload: { subject_type: 'invoice', subject_id: 'i-3' },
        }),
      ),
    ).toBe('/invoices/i-3');
    expect(
      actionRoute(
        suggestionFixture({ resulting_entity_type: 'quotes', resulting_entity_id: 'q-7' }),
      ),
    ).toBe('/quotes/q-7');
    expect(actionRoute(suggestionFixture({ kind: 'reorder', proposed_payload: {} }))).toBeNull();
  });
});
