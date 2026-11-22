import type { EChartsCoreOption } from 'echarts/core';
import {
  CostSourceKey,
  EvmGranularity,
  Scurve,
  TrafficLight,
  Waterfall,
  WbsNode,
} from './project-evm.models';

/** Translation key of each cost source of the profitability waterfall. */
export const SOURCE_KEYS: Record<CostSourceKey, string> = {
  TimesheetLabor: 'PROJECT_EVM.SRC_TIMESHEETLABOR',
  EmployeeExpense: 'PROJECT_EVM.SRC_EMPLOYEEEXPENSE',
  VendorInvoice: 'PROJECT_EVM.SRC_VENDORINVOICE',
  WarehouseMaterialIssue: 'PROJECT_EVM.SRC_WAREHOUSEMATERIALISSUE',
  OverheadAllocation: 'PROJECT_EVM.SRC_OVERHEADALLOCATION',
  Adjustment: 'PROJECT_EVM.SRC_ADJUSTMENT',
};

export const GRANULARITY_KEYS: Record<EvmGranularity, string> = {
  day: 'PROJECT_EVM.GRAN_DAY',
  week: 'PROJECT_EVM.GRAN_WEEK',
  month: 'PROJECT_EVM.GRAN_MONTH',
};

export const LIGHT_KEYS: Record<TrafficLight, string> = {
  green: 'PROJECT_EVM.LIGHT_GREEN',
  amber: 'PROJECT_EVM.LIGHT_AMBER',
  red: 'PROJECT_EVM.LIGHT_RED',
};

/** The tag colour of a traffic light. */
export function lightColor(light: TrafficLight | undefined): string {
  return light === 'red' ? 'red' : light === 'amber' ? 'gold' : 'green';
}

/** Traffic light of an index: green from 1.00, amber from 0.90, red below; an undefined index is green. */
export function indexLight(index: string | null | undefined): TrafficLight {
  if (index === null || index === undefined || index === '') {
    return 'green';
  }

  const value = Number(index);

  return value >= 1 ? 'green' : value >= 0.9 ? 'amber' : 'red';
}

/** Budget absorption above 80% is a warning. */
export function absorptionWarning(percent: string | null | undefined): boolean {
  return percent !== null && percent !== undefined && Number(percent) > 80;
}

/** The thresholds a figure set breaches (CPI or SPI below 0.90, absorption above 80%), for the alert badge. */
export function breachCount(figures: {
  cpi?: string | null;
  spi?: string | null;
  absorption?: string | null;
}): number {
  return [
    indexLight(figures.cpi) === 'red',
    indexLight(figures.spi) === 'red',
    absorptionWarning(figures.absorption),
  ].filter(Boolean).length;
}

/** A WBS node with its depth, in display order, for the indented drill-down table. */
export interface FlatWbsRow {
  node: WbsNode;
  depth: number;
  parentId: string | null;
}

/** Flattens the tree, listing the children of the nodes in `expanded` only. */
export function flattenWbs(nodes: WbsNode[], expanded: ReadonlySet<string>): FlatWbsRow[] {
  const rows: FlatWbsRow[] = [];

  const visit = (list: WbsNode[], depth: number, parentId: string | null): void => {
    for (const node of list) {
      rows.push({ node, depth, parentId });

      if (expanded.has(node.wbs_node_id) && node.children.length > 0) {
        visit(node.children, depth + 1, node.wbs_node_id);
      }
    }
  };

  visit(nodes, 0, null);

  return rows;
}

/** Ids of the nodes that have children (what the "expand all" action opens). */
export function parentIds(nodes: WbsNode[]): string[] {
  return nodes.flatMap((node) => (node.children.length > 0 ? [node.wbs_node_id, ...parentIds(node.children)] : []));
}

/** ECharts option of the S-curve: cumulative PV, EV and AC with the dashed EAC projection to the planned end. */
export function scurveOption(curve: Scurve, labels: { pv: string; ev: string; ac: string; eac: string }): EChartsCoreOption {
  const dates = [...new Set([...curve.points.map((point) => point.date), ...curve.forecast.map((point) => point.date)])].sort();
  const series = (key: 'pv' | 'ev' | 'ac'): (number | null)[] =>
    dates.map((date) => {
      const point = curve.points.find((candidate) => candidate.date === date);

      return point === undefined ? null : Number(point[key]);
    });
  const projection = dates.map((date) => {
    const point = curve.forecast.find((candidate) => candidate.date === date);

    return point === undefined ? null : Number(point.eac);
  });

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: [labels.pv, labels.ev, labels.ac, labels.eac] },
    grid: { left: 56, right: 24, top: 40, bottom: 32 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    series: [
      { name: labels.pv, type: 'line', data: series('pv'), smooth: true, connectNulls: true },
      { name: labels.ev, type: 'line', data: series('ev'), smooth: true, connectNulls: true },
      { name: labels.ac, type: 'line', data: series('ac'), smooth: true, connectNulls: true },
      {
        name: labels.eac,
        type: 'line',
        data: projection,
        connectNulls: true,
        lineStyle: { type: 'dashed' },
        symbol: 'circle',
      },
    ],
  };
}

/** ECharts option of the profitability waterfall: revenue, one negative bar per cost source, the gross margin. */
export function waterfallOption(waterfall: Waterfall, label: (key: string) => string): EChartsCoreOption {
  const categories: string[] = [];
  const base: number[] = [];
  const up: (number | null)[] = [];
  const down: (number | null)[] = [];
  const total: (number | null)[] = [];

  for (const step of waterfall.steps) {
    const amount = Number(step.amount);
    const running = Number(step.running_total);
    const isTotal = step.kind === 'total';

    categories.push(label(isTotal ? `PROJECT_EVM.STEP_${step.key.toUpperCase()}` : (SOURCE_KEYS[step.key as CostSourceKey] ?? step.key)));
    // A delta bar floats between the running total before and after it.
    base.push(isTotal ? 0 : Math.min(running, running - amount));
    total.push(isTotal ? amount : null);
    up.push(!isTotal && amount > 0 ? amount : null);
    down.push(!isTotal && amount <= 0 ? Math.abs(amount) : null);
  }

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 56, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: categories, axisLabel: { interval: 0, rotate: 20 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'base', type: 'bar', stack: 'wf', itemStyle: { color: 'transparent' }, data: base, silent: true },
      { name: 'total', type: 'bar', stack: 'wf', data: total },
      { name: 'increase', type: 'bar', stack: 'wf', data: up },
      { name: 'decrease', type: 'bar', stack: 'wf', data: down },
    ],
  };
}
