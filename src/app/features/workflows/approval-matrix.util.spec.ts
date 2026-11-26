import { describe, expect, it } from 'vitest';
import {
  emptyMatrix,
  emptyTier,
  nextPriority,
  nextTierLevel,
  parseConditionValue,
  toEditable,
  toRequest,
  validateMatrix,
} from './approval-matrix.util';

function validMatrix() {
  const matrix = emptyMatrix('purchase_order', 10, 'chf');
  matrix.code = 'PO_HIGH';
  matrix.name = 'High value orders';
  matrix.conditions = [{ field: 'amount', operator: 'gte', valueText: '10000' }];
  matrix.tiers = [{ ...emptyTier(1), approver_value: 'cfo' }];
  return matrix;
}

describe('approval matrix util', () => {
  it('parses condition values by operator', () => {
    expect(parseConditionValue('gte', ' 5000 ')).toBe(5000);
    expect(parseConditionValue('eq', 'CHF')).toBe('CHF');
    expect(parseConditionValue('eq', 'true')).toBe(true);
    expect(parseConditionValue('in', '10, 20, abc')).toEqual([10, 20, 'abc']);
    expect(parseConditionValue('between', '1000, 5000')).toEqual([1000, 5000]);
    expect(parseConditionValue('in', ' , ')).toEqual([]);
  });

  it('numbers the next priority and tier level', () => {
    expect(nextPriority([])).toBe(10);
    expect(nextPriority([{ priority: 10 }, { priority: 30 }])).toBe(40);
    expect(nextTierLevel([emptyTier(1), emptyTier(2)])).toBe(3);
  });

  it('accepts a complete matrix', () => {
    expect(validateMatrix(validMatrix())).toEqual([]);
  });

  it('reports every problem once', () => {
    const matrix = validMatrix();
    matrix.name = '';
    matrix.currency = 'EURO';
    matrix.conditions = [
      { field: 'amount', operator: 'between', valueText: '10' },
      { field: 'category', operator: 'eq', valueText: '' },
    ];
    matrix.tiers = [
      { ...emptyTier(1), approver_value: '', threshold_min: 500, threshold_max: 100 },
      { ...emptyTier(2), approver_type: 'reporting_manager' },
    ];
    matrix.fallbackType = 'user';

    expect(validateMatrix(matrix)).toEqual([
      'workflows.matrix.error.nameRequired',
      'workflows.matrix.error.currency',
      'workflows.matrix.error.between',
      'workflows.matrix.error.conditionValue',
      'workflows.matrix.error.approverRequired',
      'workflows.matrix.error.thresholdRange',
      'workflows.matrix.error.fallbackRequired',
    ]);
  });

  it('requires at least one tier', () => {
    const matrix = validMatrix();
    matrix.tiers = [];
    expect(validateMatrix(matrix)).toContain('workflows.matrix.error.tiersRequired');
  });

  it('builds the request of the API and round-trips through the editor model', () => {
    const matrix = validMatrix();
    matrix.auto_approve_below = 200;
    matrix.tiers = [
      { ...emptyTier(2), approver_type: 'reporting_manager', approver_value: 'ignored' },
      { ...emptyTier(1), approver_value: ' cfo ', threshold_max: 50000, approval_type: 'majority' },
    ];

    const request = toRequest(matrix);

    expect(request.currency).toBe('CHF');
    expect(request.auto_approve_below).toBe(200);
    expect(request.fallback_approver).toBeNull();
    expect(request.conditions).toEqual([{ field: 'amount', operator: 'gte', value: 10000 }]);
    expect(request.tiers.map((tier) => tier.tier_level)).toEqual([1, 2]);
    expect(request.tiers[0]).toMatchObject({ approver_value: 'cfo', threshold_max: 50000, approval_type: 'majority' });
    expect(request.tiers[1].approver_value).toBe('reporting_manager');

    const again = toEditable({ id: 'm1', ...request });
    expect(again.id).toBe('m1');
    expect(again.conditions[0].valueText).toBe('10000');
    expect(toRequest(again)).toEqual(request);
  });
});
