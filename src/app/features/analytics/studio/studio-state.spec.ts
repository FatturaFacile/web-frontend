import { describe, expect, it } from 'vitest';
import { AnalyticsSemanticDataset, StudioFilterGroup, StudioSavedReport } from '@core';
import { CRON_PRESETS, presetOf, readCron } from './cron-presets';
import {
  addFilterGroup,
  canRun,
  cleanFilterTree,
  dropField,
  emptyStudioState,
  filterValueFor,
  formulaProblem,
  fromSavedReport,
  moveField,
  nextCalculatedKey,
  removeFromShelf,
  setGranularity,
  toDefinition,
  updateFilterNode,
} from './studio-state';

const dataset: AnalyticsSemanticDataset = {
  key: 'sales_lines',
  label: 'Sales lines',
  module: 'invoicing',
  supports_period: true,
  period_dimension: 'date',
  dimensions: [
    { key: 'customer', label: 'Customer', type: 'string', operators: ['eq', 'in', 'contains'] },
    { key: 'invoice_type', label: 'Type', type: 'string', operators: ['eq'] },
    {
      key: 'date',
      label: 'Date',
      type: 'date',
      operators: ['gte', 'between'],
      granularities: ['day', 'month', 'year'],
    },
    { key: 'currency', label: 'Currency', type: 'string', operators: ['eq'] },
    { key: 'country', label: 'Country', type: 'string', operators: ['eq'] },
  ],
  measures: [
    { key: 'net_amount', label: 'Net amount', unit: 'currency' },
    { key: 'quantity', label: 'Quantity', unit: 'quantity' },
  ],
};

describe('studio shelf transitions', () => {
  it('puts dimensions on rows and columns, measures on values, and gives dates a granularity', () => {
    let state = emptyStudioState('sales_lines');
    state = dropField(state, dataset, 'rows', 'customer');
    state = dropField(state, dataset, 'columns', 'date');
    state = dropField(state, dataset, 'values', 'net_amount');

    expect(state.rows).toEqual(['customer']);
    expect(state.columns).toEqual(['date:month']);
    expect(state.values).toEqual(['net_amount']);
    expect(canRun(state)).toBe(true);
    expect(canRun(emptyStudioState('sales_lines'))).toBe(false);
  });

  it('refuses a measure on an axis, a dimension on values and a field the dataset does not have', () => {
    const state = emptyStudioState('sales_lines');

    expect(dropField(state, dataset, 'rows', 'net_amount')).toBe(state);
    expect(dropField(state, dataset, 'values', 'customer')).toBe(state);
    expect(dropField(state, dataset, 'rows', 'password')).toBe(state);
  });

  it('keeps a field on one axis at a time and refuses repeats', () => {
    let state = dropField(emptyStudioState('sales_lines'), dataset, 'rows', 'customer');
    state = dropField(state, dataset, 'columns', 'customer');

    expect(state.rows).toEqual([]);
    expect(state.columns).toEqual(['customer']);
    expect(dropField(state, dataset, 'columns', 'customer')).toBe(state);

    const values = dropField(emptyStudioState('sales_lines'), dataset, 'values', 'net_amount');
    expect(dropField(values, dataset, 'values', 'net_amount')).toBe(values);
  });

  it('allows at most four dimensions in total', () => {
    let state = emptyStudioState('sales_lines');
    for (const key of ['customer', 'invoice_type', 'currency']) {
      state = dropField(state, dataset, 'rows', key);
    }
    state = dropField(state, dataset, 'columns', 'date');
    const full = dropField(state, dataset, 'columns', 'country');

    expect(full).toBe(state);
    expect(state.rows.length + state.columns.length).toBe(4);
  });

  it('inserts at a position, reorders inside a shelf and moves across axes', () => {
    let state = emptyStudioState('sales_lines');
    state = dropField(state, dataset, 'rows', 'customer');
    state = dropField(state, dataset, 'rows', 'invoice_type');
    state = dropField(state, dataset, 'rows', 'currency', 1);
    expect(state.rows).toEqual(['customer', 'currency', 'invoice_type']);

    state = moveField(state, dataset, 'rows', 'rows', 2, 0);
    expect(state.rows).toEqual(['invoice_type', 'customer', 'currency']);

    state = moveField(state, dataset, 'rows', 'columns', 1, 0);
    expect(state.rows).toEqual(['invoice_type', 'currency']);
    expect(state.columns).toEqual(['customer']);
  });

  it('changes the granularity of a date only', () => {
    let state = dropField(emptyStudioState('sales_lines'), dataset, 'rows', 'date');
    state = dropField(state, dataset, 'rows', 'customer');
    state = setGranularity(state, 'rows', 'date', 'year');
    state = setGranularity(state, 'rows', 'customer', 'year');

    expect(state.rows).toEqual(['date:year', 'customer']);
  });

  it('drops the formatting rules and chart series of a measure that leaves the values', () => {
    let state = dropField(emptyStudioState('sales_lines'), dataset, 'values', 'net_amount');
    state = {
      ...state,
      formatting: [
        { target: 'net_amount', operator: 'gt', value: '1', background: 'red', text: 'default' },
      ],
      chart: { ...state.chart, series: ['net_amount'] },
    };
    state = removeFromShelf(state, 'values', 'net_amount');

    expect(state.values).toEqual([]);
    expect(state.formatting).toEqual([]);
    expect(state.chart.series).toEqual([]);
  });

  it('adds a condition when a dimension is dropped on the filters', () => {
    const state = dropField(emptyStudioState('sales_lines'), dataset, 'filters', 'customer');

    expect(state.filters.conditions).toEqual([{ field: 'customer', operator: 'eq', value: '' }]);
  });
});

describe('studio filters', () => {
  const group: StudioFilterGroup = {
    logic: 'and',
    conditions: [
      { field: 'customer', operator: 'eq', value: 'Acme' },
      { logic: 'or', conditions: [{ field: 'invoice_type', operator: 'eq', value: '' }] },
    ],
  };

  it('updates and removes nodes by path and limits the nesting', () => {
    const changed = updateFilterNode(group, [0], () => ({
      field: 'customer',
      operator: 'contains',
      value: 'Ac',
    }));
    expect(changed.conditions[0]).toEqual({ field: 'customer', operator: 'contains', value: 'Ac' });

    const removed = updateFilterNode(group, [1, 0], () => undefined);
    expect(removed.conditions[1]).toEqual({ logic: 'or', conditions: [] });

    const nested = addFilterGroup(group, [], 'or');
    expect(nested.conditions).toHaveLength(3);
    const deep = addFilterGroup(group, [1], 'and');
    expect(addFilterGroup(deep, [1, 1], 'and')).toBe(deep);
  });

  it('sends only finished conditions and no empty groups', () => {
    expect(cleanFilterTree(group)).toEqual({
      logic: 'and',
      conditions: [{ field: 'customer', operator: 'eq', value: 'Acme' }],
    });
    expect(
      cleanFilterTree({
        logic: 'and',
        conditions: [{ field: 'customer', operator: 'eq', value: '' }],
      }),
    ).toBeNull();
    expect(
      cleanFilterTree({ logic: 'or', conditions: [{ field: 'customer', operator: 'not_null' }] }),
    ).not.toBeNull();
  });

  it('turns typed text into the value of the operator', () => {
    expect(filterValueFor('in', 'a, b ,, c')).toEqual(['a', 'b', 'c']);
    expect(filterValueFor('between', '2026-01-01, 2026-12-31')).toEqual([
      '2026-01-01',
      '2026-12-31',
    ]);
    expect(filterValueFor('eq', ' x ')).toBe(' x ');
    expect(filterValueFor('is_null', 'ignored')).toBeNull();
  });
});

describe('studio definition', () => {
  it('builds the request of the API from the shelves', () => {
    let state = emptyStudioState('sales_lines');
    state = dropField(state, dataset, 'rows', 'customer');
    state = dropField(state, dataset, 'columns', 'date');
    state = dropField(state, dataset, 'values', 'net_amount');
    state = { ...state, periodPreset: 'year_to_date', subtotals: false };
    state = {
      ...state,
      filters: {
        logic: 'or',
        conditions: [{ field: 'customer', operator: 'in', value: ['A', 'B'] }],
      },
    };
    state = {
      ...state,
      calculated: [
        { key: 'calc_1', label: 'Double', formula: 'net_amount * 2', format: 'currency' },
      ],
      chart: { ...state.chart, series: ['net_amount', 'calc_1', 'gone'] },
    };

    const definition = toDefinition(state);

    expect(definition.dataset).toBe('sales_lines');
    expect(definition.spec.dimensions).toEqual(['customer', 'date:month']);
    expect(definition.spec.measures).toEqual(['net_amount']);
    expect(definition.spec.period).toEqual({ preset: 'year_to_date' });
    expect(definition.spec.filter_tree).toEqual({
      logic: 'or',
      conditions: [{ field: 'customer', operator: 'in', value: ['A', 'B'] }],
    });
    expect(definition.pivot).toEqual({
      rows: ['customer'],
      columns: ['date:month'],
      subtotals: false,
      grand_totals: true,
    });
    expect(definition.calculated_fields).toHaveLength(1);
    expect(definition.chart_config.xAxis).toBe('customer');
    expect(definition.chart_config.series).toEqual(['net_amount', 'calc_1']);
  });

  it('restores the state of a saved report, with or without a pivot layout', () => {
    const report: StudioSavedReport = {
      id: 'r1',
      user_id: 'u1',
      name: 'Matrix',
      description: null,
      dataset: 'sales_lines',
      spec: {
        dimensions: ['customer', 'date:year'],
        measures: ['net_amount'],
        filter_tree: { logic: 'and', conditions: [] },
        period: { preset: 'last_month' },
      },
      pivot: { rows: ['customer'], columns: ['date:year'], subtotals: false, grand_totals: true },
      calculated_fields: [
        { key: 'calc_1', label: 'Double', formula: 'net_amount * 2', format: 'number' },
      ],
      conditional_formatting: [],
      chart_config: { chartType: 'line', enabled: true },
      visibility: 'private',
      shared_role_ids: [],
      is_shared: false,
      shared_with: [],
      is_owner: true,
      created_at: null,
      updated_at: null,
    };

    const state = fromSavedReport(report);
    expect(state.rows).toEqual(['customer']);
    expect(state.columns).toEqual(['date:year']);
    expect(state.subtotals).toBe(false);
    expect(state.periodPreset).toBe('last_month');
    expect(state.chart.chartType).toBe('line');
    expect(state.calculated).toHaveLength(1);

    const flat = fromSavedReport({ ...report, pivot: {} });
    expect(flat.rows).toEqual(['customer', 'date:year']);
    expect(flat.columns).toEqual([]);
  });
});

describe('formula checks', () => {
  const references = ['net_amount', 'quantity'];
  const functions = ['ABS', 'ROUND', 'COALESCE', 'NULLIF'];

  it('accepts what the backend parser accepts', () => {
    expect(formulaProblem('net_amount / NULLIF(quantity, 0)', references, functions)).toBeNull();
    expect(formulaProblem('round(abs(net_amount) * 1.5, 2)', references, functions)).toBeNull();
  });

  it('names the problem with a translation key', () => {
    expect(formulaProblem('', references, functions)).toBe('ANALYTICS_STUDIO.FORMULA_EMPTY');
    expect(formulaProblem('net_amount; DROP TABLE x', references, functions)).toBe(
      'ANALYTICS_STUDIO.FORMULA_CHARACTERS',
    );
    expect(formulaProblem('(net_amount + 1', references, functions)).toBe(
      'ANALYTICS_STUDIO.FORMULA_PARENTHESES',
    );
    expect(formulaProblem('net_amount + unknown', references, functions)).toBe(
      'ANALYTICS_STUDIO.FORMULA_REFERENCE',
    );
    expect(formulaProblem('SLEEP(5)', references, functions)).toBe(
      'ANALYTICS_STUDIO.FORMULA_FUNCTION',
    );
  });

  it('numbers the calculated measures', () => {
    expect(nextCalculatedKey([])).toBe('calc_1');
    expect(nextCalculatedKey(['calc_1', 'calc_2'])).toBe('calc_3');
  });
});

describe('cron presets', () => {
  it('recognises the presets and reads the common expressions', () => {
    expect(presetOf(CRON_PRESETS.weekly_monday)).toBe('weekly_monday');
    expect(presetOf('  0   7 1 * * ')).toBe('monthly_first');
    expect(presetOf('5 4 * * 2')).toBe('custom');

    expect(readCron('0 7 * * *')).toEqual({
      key: 'ANALYTICS_STUDIO.CRON_READ_DAILY',
      params: { time: '07:00' },
    });
    expect(readCron('30 8 * * 1')).toEqual({
      key: 'ANALYTICS_STUDIO.CRON_READ_WEEKLY',
      params: { time: '08:30', weekday: 'ANALYTICS_STUDIO.WEEKDAY_MONDAY' },
    });
    expect(readCron('0 7 15 * *')).toEqual({
      key: 'ANALYTICS_STUDIO.CRON_READ_MONTHLY',
      params: { time: '07:00', day: '15' },
    });
    expect(readCron('*/10 * * * 1-5').key).toBe('ANALYTICS_STUDIO.CRON_READ_CUSTOM');
  });
});
