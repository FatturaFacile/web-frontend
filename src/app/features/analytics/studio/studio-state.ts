import {
  AnalyticsSemanticDataset,
  AnalyticsSpecFilter,
  StudioCalculatedField,
  StudioChartConfig,
  StudioDefinition,
  StudioFilterGroup,
  StudioFormattingRule,
  StudioSavedReport,
} from '@core';

/** The shelves of the studio a field can be dropped on. */
export type ShelfName = 'rows' | 'columns' | 'values' | 'filters';

export const MAX_DIMENSIONS = 4;
export const MAX_MEASURES = 8;
export const MAX_FILTER_DEPTH = 3;

/** The state of the designer: what is on each shelf, and the presentation choices. */
export interface StudioState {
  dataset: string | null;
  /** Dimension tokens: `key`, or `key:granularity` for a date. */
  rows: string[];
  columns: string[];
  /** Measure keys of the dataset (the aggregation is part of the measure). */
  values: string[];
  filters: StudioFilterGroup;
  subtotals: boolean;
  grandTotals: boolean;
  periodPreset: string | null;
  calculated: StudioCalculatedField[];
  formatting: StudioFormattingRule[];
  chart: StudioChartConfig;
}

export const DEFAULT_GRANULARITY = 'month';

export function emptyChart(): StudioChartConfig {
  return {
    enabled: true,
    chartType: 'bar',
    xAxis: null,
    series: [],
    showLegend: true,
    showDataLabels: false,
  };
}

export function emptyStudioState(dataset: string | null = null): StudioState {
  return {
    dataset,
    rows: [],
    columns: [],
    values: [],
    filters: { logic: 'and', conditions: [] },
    subtotals: true,
    grandTotals: true,
    periodPreset: null,
    calculated: [],
    formatting: [],
    chart: emptyChart(),
  };
}

export function tokenKey(token: string): string {
  return token.split(':')[0];
}

export function tokenGranularity(token: string): string | null {
  return token.includes(':') ? token.split(':')[1] : null;
}

/** The token a dimension takes on a shelf: dates carry a granularity. */
export function tokenFor(
  dataset: AnalyticsSemanticDataset,
  key: string,
  granularity = DEFAULT_GRANULARITY,
): string {
  const dimension = dataset.dimensions.find((item) => item.key === key);

  return dimension?.type === 'date' ? `${key}:${granularity}` : key;
}

export function isFilterGroup(
  node: AnalyticsSpecFilter | StudioFilterGroup,
): node is StudioFilterGroup {
  return 'conditions' in node;
}

function dimensionCount(state: StudioState): number {
  return state.rows.length + state.columns.length;
}

/**
 * Drops a field of the catalog on a shelf. Dimensions go to rows, columns or filters, measures to values; anything else,
 * a repeated field or a shelf that is full leaves the state unchanged. A dimension dropped on rows or columns leaves the
 * other shelf (a field is on one axis at a time).
 */
export function dropField(
  state: StudioState,
  dataset: AnalyticsSemanticDataset,
  shelf: ShelfName,
  key: string,
  index?: number,
): StudioState {
  const isDimension = dataset.dimensions.some((item) => item.key === key);
  const isMeasure = dataset.measures.some((item) => item.key === key);

  if (shelf === 'values') {
    if (!isMeasure || state.values.includes(key) || state.values.length >= MAX_MEASURES) {
      return state;
    }

    return { ...state, values: insertAt(state.values, key, index) };
  }

  if (!isDimension) {
    return state;
  }

  if (shelf === 'filters') {
    const condition: AnalyticsSpecFilter = {
      field: key,
      operator: defaultOperator(dataset, key),
      value: '',
    };

    return {
      ...state,
      filters: { ...state.filters, conditions: [...state.filters.conditions, condition] },
    };
  }

  const other = shelf === 'rows' ? 'columns' : 'rows';
  const existing = [...state[shelf], ...state[other]].map(tokenKey);
  const moving = state[other].find((token) => tokenKey(token) === key);

  if (state[shelf].some((token) => tokenKey(token) === key)) {
    return state;
  }

  if (moving === undefined && (existing.includes(key) || dimensionCount(state) >= MAX_DIMENSIONS)) {
    return state;
  }

  return {
    ...state,
    [shelf]: insertAt(state[shelf], moving ?? tokenFor(dataset, key), index),
    [other]: state[other].filter((token) => tokenKey(token) !== key),
  };
}

function insertAt<T>(list: T[], item: T, index?: number): T[] {
  const position = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));

  return [...list.slice(0, position), item, ...list.slice(position)];
}

/** Takes a field off a shelf. Formatting rules and chart series that pointed at a removed measure go with it. */
export function removeFromShelf(
  state: StudioState,
  shelf: Exclude<ShelfName, 'filters'>,
  key: string,
): StudioState {
  const next: StudioState = {
    ...state,
    [shelf]: state[shelf].filter((token) => tokenKey(token) !== key),
  };

  if (shelf !== 'values') {
    return next;
  }

  return {
    ...next,
    formatting: next.formatting.filter((rule) => rule.target !== key),
    chart: { ...next.chart, series: next.chart.series.filter((item) => item !== key) },
  };
}

/** Moves a field inside a shelf, or to the other axis. */
export function moveField(
  state: StudioState,
  dataset: AnalyticsSemanticDataset,
  from: Exclude<ShelfName, 'filters'>,
  to: Exclude<ShelfName, 'filters'>,
  fromIndex: number,
  toIndex: number,
): StudioState {
  if (from === to) {
    const list = [...state[from]];
    if (fromIndex < 0 || fromIndex >= list.length) {
      return state;
    }
    const [item] = list.splice(fromIndex, 1);
    list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, item);

    return { ...state, [from]: list };
  }

  const key = tokenKey(state[from][fromIndex] ?? '');

  return key === '' ? state : dropField(state, dataset, to, key, toIndex);
}

export function setGranularity(
  state: StudioState,
  shelf: 'rows' | 'columns',
  key: string,
  granularity: string,
): StudioState {
  return {
    ...state,
    [shelf]: state[shelf].map((token) =>
      tokenKey(token) === key && tokenGranularity(token) !== null ? `${key}:${granularity}` : token,
    ),
  };
}

export function defaultOperator(dataset: AnalyticsSemanticDataset, key: string): string {
  const operators = dataset.dimensions.find((item) => item.key === key)?.operators ?? [];

  return operators.includes('eq') ? 'eq' : (operators[0] ?? 'eq');
}

/** Replaces the node at `path` (indices from the root group) with the result of `change`; undefined removes it. */
export function updateFilterNode(
  root: StudioFilterGroup,
  path: number[],
  change: (
    node: AnalyticsSpecFilter | StudioFilterGroup,
  ) => AnalyticsSpecFilter | StudioFilterGroup | undefined,
): StudioFilterGroup {
  if (path.length === 0) {
    const replaced = change(root);

    return replaced !== undefined && isFilterGroup(replaced) ? replaced : root;
  }

  const [head, ...rest] = path;
  const conditions = root.conditions.flatMap((node, index) => {
    if (index !== head) {
      return [node];
    }
    if (rest.length === 0) {
      const replaced = change(node);

      return replaced === undefined ? [] : [replaced];
    }

    return isFilterGroup(node) ? [updateFilterNode(node, rest, change)] : [node];
  });

  return { ...root, conditions };
}

/** Adds an empty nested group, only while the nesting stays within the limit of the API. */
export function addFilterGroup(
  root: StudioFilterGroup,
  path: number[],
  logic: 'and' | 'or',
): StudioFilterGroup {
  if (path.length + 2 > MAX_FILTER_DEPTH) {
    return root;
  }

  return updateFilterNode(root, path, (node) =>
    isFilterGroup(node)
      ? { ...node, conditions: [...node.conditions, { logic, conditions: [] }] }
      : node,
  );
}

/** The filter group without empty groups and unfinished conditions (what the API gets), or null when nothing is left. */
export function cleanFilterTree(group: StudioFilterGroup): StudioFilterGroup | null {
  const conditions = group.conditions.flatMap(
    (node): (AnalyticsSpecFilter | StudioFilterGroup)[] => {
      if (isFilterGroup(node)) {
        const inner = cleanFilterTree(node);

        return inner === null ? [] : [inner];
      }

      const needsValue = !['is_null', 'not_null'].includes(node.operator);
      const empty =
        node.value === '' ||
        node.value === null ||
        node.value === undefined ||
        (Array.isArray(node.value) && node.value.length === 0);

      return needsValue && empty ? [] : [node];
    },
  );

  return conditions.length === 0 ? null : { logic: group.logic, conditions };
}

/** Turns the text a user typed into the value the API expects for an operator (lists and ranges are comma separated). */
export function filterValueFor(operator: string, text: string): unknown {
  if (['is_null', 'not_null'].includes(operator)) {
    return null;
  }
  if (['in', 'not_in', 'between'].includes(operator)) {
    return text
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');
  }

  return text;
}

export function filterValueText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return value === null || value === undefined ? '' : String(value);
}

export function canRun(state: StudioState): boolean {
  return state.dataset !== null && state.values.length > 0;
}

/** The definition the API runs, exports and saves, built from the state. */
export function toDefinition(state: StudioState): StudioDefinition {
  const tree = cleanFilterTree(state.filters);
  const valueKeys = [...state.values, ...state.calculated.map((field) => field.key)];
  const chartX =
    state.chart.xAxis ??
    (state.rows.length > 0
      ? tokenKey(state.rows[0])
      : state.columns.length > 0
        ? tokenKey(state.columns[0])
        : null);

  return {
    dataset: state.dataset ?? '',
    spec: {
      dimensions: [...state.rows, ...state.columns],
      measures: state.values,
      filters: [],
      sort: [],
      limit: null,
      period: state.periodPreset === null ? null : { preset: state.periodPreset as never },
      compare: 'none',
      filter_tree: tree,
    },
    pivot: {
      rows: state.rows,
      columns: state.columns,
      subtotals: state.subtotals,
      grand_totals: state.grandTotals,
    },
    calculated_fields: state.calculated,
    conditional_formatting: state.formatting,
    chart_config: {
      ...state.chart,
      xAxis: chartX,
      series: state.chart.series.filter((key) => valueKeys.includes(key)),
    },
  };
}

/** The state of a saved report. */
export function fromSavedReport(report: StudioSavedReport): StudioState {
  const pivot = report.pivot ?? {};
  const spec = report.spec;
  const hasLayout = (pivot.rows?.length ?? 0) + (pivot.columns?.length ?? 0) > 0;

  return {
    dataset: report.dataset,
    rows: hasLayout ? [...(pivot.rows ?? [])] : [...(spec.dimensions ?? [])],
    columns: hasLayout ? [...(pivot.columns ?? [])] : [],
    values: [...spec.measures],
    filters: spec.filter_tree ?? { logic: 'and', conditions: [] },
    subtotals: pivot.subtotals ?? true,
    grandTotals: pivot.grand_totals ?? true,
    periodPreset: spec.period?.preset ?? null,
    calculated: [...(report.calculated_fields ?? [])],
    formatting: [...(report.conditional_formatting ?? [])],
    chart: { ...emptyChart(), ...(report.chart_config ?? {}) },
  };
}

/** Allowed characters of a calculated measure formula, checked before the backend validates it for real. */
const FORMULA_TOKEN = /^[A-Za-z0-9_+\-*/(),.\s]+$/;

/**
 * A quick local check of a formula: the characters of the whitelist, balanced parentheses, functions and references that
 * exist. Returns a translation key of the problem, or null. The backend parser stays the authority.
 */
export function formulaProblem(
  formula: string,
  references: string[],
  functions: string[],
): string | null {
  const text = formula.trim();

  if (text === '') {
    return 'ANALYTICS_STUDIO.FORMULA_EMPTY';
  }
  if (!FORMULA_TOKEN.test(text)) {
    return 'ANALYTICS_STUDIO.FORMULA_CHARACTERS';
  }

  let depth = 0;
  for (const char of text) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (depth < 0) {
      break;
    }
  }
  if (depth !== 0) {
    return 'ANALYTICS_STUDIO.FORMULA_PARENTHESES';
  }

  for (const match of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    const name = match[0];
    const isCall = text
      .slice((match.index ?? 0) + name.length)
      .trimStart()
      .startsWith('(');

    if (isCall ? !functions.includes(name.toUpperCase()) : !references.includes(name)) {
      return isCall ? 'ANALYTICS_STUDIO.FORMULA_FUNCTION' : 'ANALYTICS_STUDIO.FORMULA_REFERENCE';
    }
  }

  return null;
}

/** A key for a new calculated measure that is not taken. */
export function nextCalculatedKey(existing: string[]): string {
  let index = 1;
  while (existing.includes(`calc_${index}`)) {
    index++;
  }

  return `calc_${index}`;
}
