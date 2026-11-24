import { describe, expect, it } from 'vitest';
import {
  blockingPriceLine,
  blockingQuantityLine,
  matchLine,
  matchRun,
  toleranceRule,
  withinToleranceLine,
} from './invoice-matching.fixtures';
import {
  blockingLines,
  canResolve,
  cellHighlight,
  describeTolerance,
  highlightClass,
  isForbidden,
  lineStatusColor,
  matchStatusColor,
  rowHighlight,
  ruleToFormValue,
  scopeUsesCategory,
  scopeUsesSupplier,
  toRulePayload,
} from './invoice-matching.helpers';

describe('matchStatusColor', () => {
  it('maps every run status to its tag colour', () => {
    expect(matchStatusColor('matched')).toBe('green');
    expect(matchStatusColor('within_tolerance')).toBe('cyan');
    expect(matchStatusColor('blocked_discrepancy')).toBe('red');
    expect(matchStatusColor('pending_credit_note')).toBe('orange');
    expect(matchStatusColor('override_approved')).toBe('purple');
    expect(matchStatusColor('resolved')).toBe('blue');
  });

  it('colours the blocking line statuses red', () => {
    expect(lineStatusColor('price_variance')).toBe('red');
    expect(lineStatusColor('matched')).toBe('green');
  });
});

describe('cellHighlight', () => {
  it('does not highlight an exact match', () => {
    const line = matchLine('a');
    expect(cellHighlight(line, 'quantity')).toBe('none');
    expect(cellHighlight(line, 'price')).toBe('none');
    expect(cellHighlight(line, 'amount')).toBe('none');
    expect(rowHighlight(line)).toBe('none');
  });

  it('highlights a variance inside the tolerance as within', () => {
    const line = withinToleranceLine();
    expect(cellHighlight(line, 'price')).toBe('within');
    expect(cellHighlight(line, 'amount')).toBe('within');
    expect(cellHighlight(line, 'quantity')).toBe('none');
    expect(rowHighlight(line)).toBe('within');
  });

  it('highlights only the price and amount cells of a line blocked on price', () => {
    const line = blockingPriceLine();
    expect(cellHighlight(line, 'price')).toBe('out');
    expect(cellHighlight(line, 'amount')).toBe('out');
    expect(cellHighlight(line, 'quantity')).toBe('none');
    expect(rowHighlight(line)).toBe('out');
  });

  it('highlights only the quantity and amount cells of a line blocked on quantity', () => {
    const line = blockingQuantityLine();
    expect(cellHighlight(line, 'quantity')).toBe('out');
    expect(cellHighlight(line, 'amount')).toBe('out');
    expect(cellHighlight(line, 'price')).toBe('none');
  });

  it('keeps a non-blocking variance of a blocking line amber when it did not cause the block', () => {
    const line = matchLine('b', {
      status: 'price_variance',
      is_blocking: true,
      reasons: ['price_above_tolerance'],
      price_variance: 1,
      quantity_variance: 0.1,
      allowed_quantity_variance: 0.5,
      amount_variance: 0.4,
      allowed_amount_variance: 1,
    });
    expect(cellHighlight(line, 'quantity')).toBe('within');
  });

  it('maps highlights to css classes', () => {
    expect(highlightClass('out')).toBe('variance-out');
    expect(highlightClass('within')).toBe('variance-within');
    expect(highlightClass('none')).toBe('');
  });

  it('treats an accepted line with a variance as within tolerance', () => {
    const line = matchLine('c', { status: 'accepted', price_variance: 1, amount_variance: 10 });
    expect(rowHighlight(line)).toBe('within');
  });
});

describe('resolution helpers', () => {
  it('offers the resolution only while the run blocks the payment', () => {
    expect(canResolve(matchRun())).toBe(true);
    expect(canResolve(matchRun({ is_blocking: false, status: 'matched' }))).toBe(false);
    expect(canResolve(null)).toBe(false);
  });

  it('selects only blocking lines for a partial resolution', () => {
    expect(blockingLines(matchRun()).map((line) => line.id)).toEqual(['l-blocking', 'l-qty']);
    expect(blockingLines(null)).toEqual([]);
  });

  it('detects a 403 answer', () => {
    expect(isForbidden({ status: 403 })).toBe(true);
    expect(isForbidden({ status: 422 })).toBe(false);
    expect(isForbidden(null)).toBe(false);
  });
});

describe('tolerance snapshot', () => {
  it('describes the known fields and skips the rest', () => {
    const [entry] = describeTolerance([
      { name: 'Default', scope: 'tenant', price_tolerance_percent: 2, unknown: 'x', note: null },
    ]);
    expect(entry.map((item) => item.labelKey)).toEqual([
      'invoiceMatching.form.name',
      'invoiceMatching.form.scope',
      'invoiceMatching.form.priceTolerancePercent',
    ]);
    expect(entry[1].valueKey).toBe('invoiceMatching.scope.tenant');
    expect(describeTolerance(null)).toEqual([]);
  });
});

describe('tolerance rule form mapping', () => {
  const base = ruleToFormValue(toleranceRule('r-1'));

  it('keeps the supplier only for the supplier and rule scopes', () => {
    expect(scopeUsesSupplier('supplier')).toBe(true);
    expect(scopeUsesSupplier('tenant')).toBe(false);
    expect(scopeUsesCategory('item_category')).toBe(true);
    expect(scopeUsesCategory('supplier')).toBe(false);

    const tenant = toRulePayload({
      ...base,
      scope: 'tenant',
      supplier_id: 's-1',
      item_category: 'c',
    });
    expect(tenant.supplier_id).toBeNull();
    expect(tenant.item_category).toBeNull();

    const rule = toRulePayload({
      ...base,
      scope: 'rule',
      supplier_id: ' s-1 ',
      item_category: 'c',
    });
    expect(rule.supplier_id).toBe('s-1');
    expect(rule.item_category).toBe('c');
  });

  it('turns "any" into a null match type and blanks into null', () => {
    const payload = toRulePayload({ ...base, match_type: 'any', currency: ' chf ', notes: '  ' });
    expect(payload.match_type).toBeNull();
    expect(payload.currency).toBe('CHF');
    expect(payload.notes).toBeNull();
    expect(toRulePayload({ ...base, match_type: '3_way' }).match_type).toBe('3_way');
  });

  it('loads an existing rule into the form', () => {
    const value = ruleToFormValue(toleranceRule('r-2', { match_type: '2_way', notes: 'n' }));
    expect(value.match_type).toBe('2_way');
    expect(value.notes).toBe('n');
    expect(ruleToFormValue(toleranceRule('r-3')).match_type).toBe('any');
  });
});
