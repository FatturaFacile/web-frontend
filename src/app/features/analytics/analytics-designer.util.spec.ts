import { AnalyticsSemanticDataset } from '@core';
import { buildFilters, buildSpec, DesignerState, emptyDesignerState, stateFromSpec } from './analytics-designer.util';

const dataset: AnalyticsSemanticDataset = {
  key: 'sales',
  label: 'Sales',
  module: 'invoicing',
  supports_period: true,
  period_dimension: 'date',
  dimensions: [
    { key: 'customer', label: 'Customer', type: 'string' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'paid', label: 'Paid', type: 'boolean' },
  ],
  measures: [{ key: 'net_amount', label: 'Net amount', unit: 'currency' }],
};

describe('analytics designer util', () => {
  it('adds the granularity to date dimensions only', () => {
    const state: DesignerState = { ...emptyDesignerState(), dimensions: ['customer', 'date'], granularity: 'quarter', measures: ['net_amount'] };

    expect(buildSpec(state, dataset).dimensions).toEqual(['customer', 'date:quarter']);
  });

  it('sends a period preset only for datasets that support one', () => {
    const state: DesignerState = { ...emptyDesignerState(), measures: ['net_amount'], periodPreset: 'last_30_days' };

    expect(buildSpec(state, dataset).period).toEqual({ preset: 'last_30_days' });
    expect(buildSpec(state, { ...dataset, supports_period: false }).period).toBeNull();
  });

  it('turns the sort and the limit into the spec', () => {
    const state: DesignerState = { ...emptyDesignerState(), measures: ['net_amount'], sortField: 'net_amount', sortDirection: 'asc', limit: 10 };
    const spec = buildSpec(state, dataset);

    expect(spec.sort).toEqual([{ field: 'net_amount', direction: 'asc' }]);
    expect(spec.limit).toBe(10);
  });

  it('types filter values and builds lists', () => {
    const filters = buildFilters(
      [
        { field: 'customer', operator: 'in', value: 'A, B' },
        { field: 'quantity', operator: 'between', value: '1, 5' },
        { field: 'net_amount', operator: 'gt', value: '100' },
        { field: 'paid', operator: 'eq', value: 'true' },
        { field: 'customer', operator: 'is_null', value: '' },
        { field: 'customer', operator: 'eq', value: '  ' },
      ],
      dataset
    );

    expect(filters).toEqual([
      { field: 'customer', operator: 'in', value: ['A', 'B'] },
      { field: 'quantity', operator: 'between', value: [1, 5] },
      { field: 'net_amount', operator: 'gt', value: 100 },
      { field: 'paid', operator: 'eq', value: true },
      { field: 'customer', operator: 'is_null' },
    ]);
  });

  it('restores the form from a saved spec', () => {
    const state: DesignerState = {
      ...emptyDesignerState(),
      dimensions: ['customer', 'date'],
      granularity: 'week',
      measures: ['net_amount'],
      filters: [{ field: 'customer', operator: 'in', value: 'A, B' }],
      sortField: 'net_amount',
      limit: 5,
      compare: 'previous_year',
    };

    expect(stateFromSpec(buildSpec(state, dataset))).toEqual(state);
  });
});
