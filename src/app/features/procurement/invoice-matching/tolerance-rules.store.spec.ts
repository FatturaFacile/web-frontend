import { TestBed } from '@angular/core/testing';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toleranceRule } from './invoice-matching.fixtures';
import { ruleToFormValue, toRulePayload } from './invoice-matching.helpers';
import { sortByPrecedence, ToleranceRulesStore } from './tolerance-rules.store';

describe('sortByPrecedence', () => {
  it('orders rule > supplier > item category > tenant, then by priority', () => {
    const rules = [
      toleranceRule('tenant', { scope: 'tenant' }),
      toleranceRule('category', { scope: 'item_category' }),
      toleranceRule('supplier-low', { scope: 'supplier', priority: 1 }),
      toleranceRule('supplier-high', { scope: 'supplier', priority: 9 }),
      toleranceRule('rule', { scope: 'rule' }),
    ];
    expect(sortByPrecedence(rules).map((rule) => rule.id)).toEqual([
      'rule',
      'supplier-high',
      'supplier-low',
      'category',
      'tenant',
    ]);
  });
});

describe('ToleranceRulesStore', () => {
  const api = {
    listRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  };
  let store: InstanceType<typeof ToleranceRulesStore>;
  const payload = toRulePayload(ruleToFormValue(toleranceRule('x')));

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [ToleranceRulesStore, { provide: InvoiceMatchingApiService, useValue: api }],
    });
    store = TestBed.inject(ToleranceRulesStore);
  });

  it('loads the rules in precedence order', async () => {
    api.listRules.mockReturnValue(
      of([toleranceRule('a', { scope: 'tenant' }), toleranceRule('b', { scope: 'rule' })]),
    );
    await store.load();
    expect(store.ordered().map((rule) => rule.id)).toEqual(['b', 'a']);
  });

  it('adds, updates and removes a rule', async () => {
    api.listRules.mockReturnValue(of([toleranceRule('a')]));
    await store.load();

    api.createRule.mockReturnValue(of(toleranceRule('b')));
    expect((await store.create(payload)).ok).toBe(true);
    expect(store.rules()).toHaveLength(2);

    api.updateRule.mockReturnValue(of(toleranceRule('b', { name: 'Renamed' })));
    await store.update('b', payload);
    expect(store.rules().find((rule) => rule.id === 'b')?.name).toBe('Renamed');

    api.deleteRule.mockReturnValue(of(undefined));
    await store.remove('a');
    expect(store.rules().map((rule) => rule.id)).toEqual(['b']);
  });

  it('keeps the API message of a rejected rule', async () => {
    api.createRule.mockReturnValue(
      throwError(() => ({ status: 422, error: { message: 'Invalid' } })),
    );
    const outcome = await store.create(payload);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe('Invalid');
    expect(store.rules()).toEqual([]);
  });
});
