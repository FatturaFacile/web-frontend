import { describe, expect, it } from 'vitest';
import { Scurve, Waterfall, WbsNode } from './project-evm.models';
import {
  absorptionWarning,
  breachCount,
  flattenWbs,
  indexLight,
  lightColor,
  parentIds,
  scurveOption,
  waterfallOption,
} from './project-evm.utils';

function node(id: string, children: WbsNode[] = []): WbsNode {
  return { wbs_node_id: id, wbs_code: id, title: `Node ${id}`, has_snapshot: true, children };
}

describe('traffic lights', () => {
  it('is green from 1.00, amber from 0.90 and red below; undefined is green', () => {
    expect(indexLight('1.0000')).toBe('green');
    expect(indexLight('1.2')).toBe('green');
    expect(indexLight('0.9500')).toBe('amber');
    expect(indexLight('0.9000')).toBe('amber');
    expect(indexLight('0.8999')).toBe('red');
    expect(indexLight(null)).toBe('green');
    expect(indexLight(undefined)).toBe('green');
  });

  it('maps a light to a tag colour', () => {
    expect(lightColor('green')).toBe('green');
    expect(lightColor('amber')).toBe('gold');
    expect(lightColor('red')).toBe('red');
    expect(lightColor(undefined)).toBe('green');
  });

  it('warns above 80% of budget absorption only', () => {
    expect(absorptionWarning('80.00')).toBe(false);
    expect(absorptionWarning('80.01')).toBe(true);
    expect(absorptionWarning(null)).toBe(false);
  });

  it('counts the breached thresholds', () => {
    expect(breachCount({ cpi: '1.00', spi: '1.00', absorption: '10' })).toBe(0);
    expect(breachCount({ cpi: '0.80', spi: '0.50', absorption: '95' })).toBe(3);
    expect(breachCount({ cpi: '0.95', spi: null, absorption: null })).toBe(0);
  });
});

describe('WBS drill-down', () => {
  const tree = [node('1', [node('1.1'), node('1.2', [node('1.2.1')])]), node('2')];

  it('lists the top level only while nothing is expanded', () => {
    expect(flattenWbs(tree, new Set()).map((row) => row.node.wbs_node_id)).toEqual(['1', '2']);
  });

  it('lists the children of the expanded nodes with their depth', () => {
    const rows = flattenWbs(tree, new Set(['1', '1.2']));

    expect(rows.map((row) => `${row.depth}:${row.node.wbs_node_id}`)).toEqual(['0:1', '1:1.1', '1:1.2', '2:1.2.1', '0:2']);
    expect(rows[1].parentId).toBe('1');
  });

  it('finds the nodes that have children', () => {
    expect(parentIds(tree)).toEqual(['1', '1.2']);
  });
});

describe('chart options', () => {
  const labels = { pv: 'PV', ev: 'EV', ac: 'AC', eac: 'EAC' };
  const curve: Scurve = {
    granularity: 'month',
    currency: 'EUR',
    points: [
      { date: '2027-01-31', pv: '100.00', ev: '80.00', ac: '90.00' },
      { date: '2027-02-28', pv: '200.00', ev: '150.00', ac: '170.00' },
    ],
    forecast: [
      { date: '2027-02-28', eac: '170.00' },
      { date: '2027-06-30', eac: '600.00' },
    ],
  };

  it('plots the cumulative curves and the EAC projection on one date axis', () => {
    const option = scurveOption(curve, labels) as { xAxis: { data: string[] }; series: { name: string; data: (number | null)[] }[] };

    expect(option.xAxis.data).toEqual(['2027-01-31', '2027-02-28', '2027-06-30']);
    expect(option.series.map((series) => series.name)).toEqual(['PV', 'EV', 'AC', 'EAC']);
    expect(option.series[0].data).toEqual([100, 200, null]);
    expect(option.series[3].data).toEqual([null, 170, 600]);
  });

  it('floats the cost bars between the running totals of the waterfall', () => {
    const waterfall: Waterfall = {
      project_id: 'p1',
      currency: 'EUR',
      snapshot_date: '2027-03-01',
      recognized_revenue: '1000.00',
      total_cost: '700.00',
      gross_margin_amount: '300.00',
      gross_margin_percent: '30.00',
      steps: [
        { key: 'revenue', amount: '1000.00', running_total: '1000.00', kind: 'total' },
        { key: 'TimesheetLabor', amount: '-500.00', running_total: '500.00', kind: 'delta' },
        { key: 'VendorInvoice', amount: '-200.00', running_total: '300.00', kind: 'delta' },
        { key: 'gross_margin', amount: '300.00', running_total: '300.00', kind: 'total' },
      ],
      variance_bridge: { budget_at_completion: '0.00', estimate_at_completion: '0.00', variance_at_completion: '0.00', committed_cost: '0.00' },
    };
    const option = waterfallOption(waterfall, (key) => key) as {
      xAxis: { data: string[] };
      series: { name: string; data: (number | null)[] }[];
    };
    const series = Object.fromEntries(option.series.map((item) => [item.name, item.data]));

    expect(option.xAxis.data).toEqual(['PROJECT_EVM.STEP_REVENUE', 'PROJECT_EVM.SRC_TIMESHEETLABOR', 'PROJECT_EVM.SRC_VENDORINVOICE', 'PROJECT_EVM.STEP_GROSS_MARGIN']);
    expect(series['base']).toEqual([0, 500, 300, 0]);
    expect(series['total']).toEqual([1000, null, null, 300]);
    expect(series['decrease']).toEqual([null, 500, 200, null]);
  });
});
