import { describe, expect, it } from 'vitest';
import {
  AnalyticalCenterNode,
  ApportionmentAllocation,
  ApportionmentRunStep,
  ContributionMarginStatement,
} from '@core';
import {
  allocateCents,
  flattenTree,
  fromCents,
  invalidParents,
  marginLevels,
  percentOf,
  problemDetail,
  splitVectors,
  statementIsConsistent,
  toCents,
  traceByStep,
  visibleRows,
} from './analytical-accounting.util';

const node = (id: string, children: AnalyticalCenterNode[] = []): AnalyticalCenterNode => ({
  id,
  parent_id: null,
  code: id.toUpperCase(),
  name: id,
  center_type: 'COST_CENTER',
  category: 'PRODUCTION',
  path: `/${id}/`,
  depth: 0,
  manager_user_id: null,
  manager_name: null,
  is_active: true,
  valid_from: null,
  valid_to: null,
  children,
});

describe('cents helpers', () => {
  it('rounds half away from zero and formats back', () => {
    expect(toCents('10.005')).toBe(1001);
    expect(toCents('-10.005')).toBe(-1001);
    expect(toCents(null)).toBe(0);
    expect(toCents('abc')).toBe(0);
    expect(fromCents(-1234)).toBe('-12.34');
    expect(fromCents(5)).toBe('0.05');
  });

  it('allocates with the largest remainder so the parts add up to the total', () => {
    expect(allocateCents(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateCents(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(allocateCents(100, [0, 0])).toEqual([0, 0]);
    for (const total of [1, 7, 99, 12345, 999999]) {
      const parts = allocateCents(total, [17.3333, 0.0001, 99.9, 3.14159, 42]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe('splitVectors', () => {
  it('splits by percentage with exact rounding', () => {
    const result = splitVectors('100.01', [
      { cost_center_id: 'a', percentage: 50 },
      { cost_center_id: 'b', percentage: 25 },
      { profit_center_id: 'c', percentage: 25 },
    ]);

    expect(result.valid).toBe(true);
    expect(result.mode).toBe('percentage');
    expect(result.amounts).toEqual([5001, 2500, 2500]);
  });

  it('accepts exact amounts that add up to the line', () => {
    const result = splitVectors(100, [
      { cost_center_id: 'a', amount: '60.00' },
      { project_id: 'p', amount: '40.00' },
    ]);

    expect(result.valid).toBe(true);
    expect(result.amounts).toEqual([6000, 4000]);
  });

  it('reports every broken rule', () => {
    expect(splitVectors(100, []).errors).toEqual(['ANALYTICAL.VECTOR_REQUIRED']);
    expect(
      splitVectors(100, [
        { cost_center_id: 'a', percentage: 60 },
        { cost_center_id: 'b', percentage: 30 },
      ]).errors,
    ).toEqual(['ANALYTICAL.VECTOR_PERCENT_SUM']);
    expect(
      splitVectors(100, [
        { cost_center_id: 'a', amount: '60' },
        { cost_center_id: 'b', amount: '30' },
      ]).errors,
    ).toEqual(['ANALYTICAL.VECTOR_AMOUNT_SUM']);
    expect(
      splitVectors(100, [
        { cost_center_id: 'a', amount: '60' },
        { cost_center_id: 'b', percentage: 40 },
      ]).errors,
    ).toContain('ANALYTICAL.VECTOR_MIXED_MODES');
    expect(splitVectors(100, [{ percentage: 100 }]).errors).toContain(
      'ANALYTICAL.VECTOR_TARGET_REQUIRED',
    );
  });
});

describe('center tree helpers', () => {
  const tree = [node('root', [node('a', [node('b')]), node('c')])];

  it('lists the rows depth first and skips collapsed branches', () => {
    expect(visibleRows(tree, new Set()).map((row) => `${row.node.id}:${row.depth}`)).toEqual([
      'root:0',
      'a:1',
      'b:2',
      'c:1',
    ]);
    expect(visibleRows(tree, new Set(['a'])).map((row) => row.node.id)).toEqual(['root', 'a', 'c']);
  });

  it('forbids moving a center under itself or a descendant', () => {
    expect(flattenTree(tree)).toHaveLength(4);
    expect([...invalidParents(tree, 'a')].sort()).toEqual(['a', 'b']);
    expect([...invalidParents(tree, 'ghost')]).toEqual(['ghost']);
  });
});

describe('margin levels', () => {
  const statement: ContributionMarginStatement = {
    operating_revenues: '5000.00',
    direct_variable_costs: '400.00',
    contribution_margin_1: '4600.00',
    contribution_margin_1_pct: '92.00',
    direct_fixed_costs: '1000.00',
    contribution_margin_2: '3600.00',
    contribution_margin_2_pct: '72.00',
    indirect_costs: '0.00',
    apportioned_costs: '250.00',
    operating_result: '3350.00',
    operating_result_pct: '67.00',
    non_operating: '0.00',
  };

  it('derives contribution margin I, II and the operating result', () => {
    expect(
      marginLevels({ revenues: '5000', variable: '400', fixed: '1000', indirect: '0', apportioned: '250' }),
    ).toEqual({ contributionMargin1: '4600.00', contributionMargin2: '3600.00', operatingResult: '3350.00' });
    expect(percentOf(250, 1000)).toBe('25.00');
    expect(percentOf(1, 0)).toBe('0.00');
  });

  it('checks that a reported statement adds up', () => {
    expect(statementIsConsistent(statement)).toBe(true);
    expect(statementIsConsistent({ ...statement, operating_result: '9999.00' })).toBe(false);
  });
});

describe('traceByStep', () => {
  const step = (order: number, status: 'EXECUTED' | 'SKIPPED', pool: string): ApportionmentRunStep => ({
    step_order: order,
    source_center_id: `s${order}`,
    driver_type: 'AREA_SQM',
    status,
    pool_amount: pool,
    allocated_amount: pool,
    driver_total: '400.0000',
    warnings: [],
  });
  const allocation = (order: number, amount: string): ApportionmentAllocation => ({
    id: `${order}-${amount}`,
    step_order: order,
    source_center_id: `s${order}`,
    target_center_id: 't',
    driver_type: 'AREA_SQM',
    driver_value: '1.0000',
    driver_total: '2.0000',
    share_ratio: '0.50000000',
    allocated_amount: amount,
    rounding_adjustment: '0.0000',
    analytical_entry_id: null,
  });

  it('groups the allocations under their step in step order and flags unbalanced steps', () => {
    const traces = traceByStep(
      [step(2, 'EXECUTED', '100.0000'), step(1, 'EXECUTED', '1000.0000'), step(3, 'SKIPPED', '0.0000')],
      [allocation(1, '750.0000'), allocation(1, '250.0000'), allocation(2, '90.0000')],
    );

    expect(traces.map((t) => t.step.step_order)).toEqual([1, 2, 3]);
    expect(traces[0].allocatedCents).toBe(100000);
    expect(traces[0].balanced).toBe(true);
    expect(traces[1].balanced).toBe(false);
    expect(traces[2].balanced).toBe(true);
  });
});

describe('problemDetail', () => {
  it('prefers the first validation message, then the message', () => {
    expect(problemDetail({ error: { errors: { request: ['Nothing to apportion'] }, message: 'x' } })).toBe(
      'Nothing to apportion',
    );
    expect(problemDetail({ error: { message: 'Forbidden' } })).toBe('Forbidden');
    expect(problemDetail(new Error('boom'))).toBeNull();
  });
});
