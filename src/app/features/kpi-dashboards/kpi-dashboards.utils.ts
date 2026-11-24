import {
  CockpitFilters,
  CockpitWidget,
  DisplayCurrency,
  DrillSegment,
  LayoutWidget,
  PeriodPreset,
  WidgetType,
} from './kpi-dashboards.models';

export const GRID_COLUMNS = 12;
export const WIDTH_STEPS = [4, 6, 12] as const;

export const BUCKET_KEYS = ['current', '1_30', '31_60', '61_90', 'over_90'] as const;

/** Translation key of a KPI title (`KPI_DASHBOARDS.KPI_DSO`) or description (`..._DESC`). */
export function kpiTitleKey(kpiCode: string): string {
  return `KPI_DASHBOARDS.KPI_${kpiCode.toUpperCase()}`;
}

export function kpiDescriptionKey(kpiCode: string): string {
  return `${kpiTitleKey(kpiCode)}_DESC`;
}

export function bucketKey(bucket: string): string {
  return `KPI_DASHBOARDS.BUCKET_${bucket.toUpperCase()}`;
}

export function presetKey(preset: PeriodPreset): string {
  return `KPI_DASHBOARDS.PRESET_${preset.toUpperCase()}`;
}

export const DEFAULT_FILTERS: CockpitFilters = {
  preset: 'ytd',
  from: null,
  to: null,
  comparison: 'yoy',
  companyIds: [],
  costCenterIds: [],
  currency: 'CHF',
  consolidated: false,
};

/** A draft widget of the layout editor: what the user placed, in order, before it is packed on the grid. */
export interface DraftWidget {
  kpi_code: string;
  widget_type: WidgetType;
  w: number;
  h: number;
}

/**
 * Packs the draft widgets, in order, left to right on the 12-column grid: a widget that does not fit the rest of the row
 * starts the next one, and a row is as tall as its tallest widget.
 */
export function packLayout(draft: readonly DraftWidget[]): LayoutWidget[] {
  const placed: LayoutWidget[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const widget of draft) {
    const w = Math.min(Math.max(widget.w, 1), GRID_COLUMNS);

    if (x + w > GRID_COLUMNS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }

    placed.push({
      kpi_code: widget.kpi_code,
      widget_type: widget.widget_type,
      x,
      y,
      w,
      h: widget.h,
    });
    x += w;
    rowHeight = Math.max(rowHeight, widget.h);
  }

  return placed;
}

/** The next width of the resize control: 4 → 6 → 12 → 4 columns. */
export function nextWidth(width: number): number {
  const index = WIDTH_STEPS.findIndex((step) => step >= width);

  return WIDTH_STEPS[(index + 1) % WIDTH_STEPS.length] ?? WIDTH_STEPS[0];
}

/** Moves an item of a list, as a drag-and-drop reorder does. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];

  if (from < 0 || from >= next.length || to < 0 || to >= next.length) {
    return next;
  }

  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);

  return next;
}

export function draftOf(widgets: readonly CockpitWidget[]): DraftWidget[] {
  return [...widgets]
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((widget) => ({
      kpi_code: widget.kpi_code,
      widget_type: widget.widget_type,
      w: widget.position.w,
      h: widget.position.h,
    }));
}

export type Unit = 'currency' | 'percent' | 'days' | 'months' | 'hours' | 'ratio' | 'fte' | 'count';

export function unitOf(widget: CockpitWidget): Unit {
  const unit = widget.data['unit'];

  return typeof unit === 'string' ? (unit as Unit) : 'count';
}

/** A KPI value as the card shows it; `null` is a KPI that cannot be computed for the period. */
export function formatValue(
  value: number | null,
  unit: Unit,
  currency: DisplayCurrency,
  locale: string,
): string {
  if (value === null) {
    return '–';
  }

  switch (unit) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} %`;
    default:
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  }
}

/** The trend direction of a comparison, for the badge: higher is not always better, the card decides the colour. */
export function trendOf(delta: number | null): 'up' | 'down' | 'flat' | 'none' {
  if (delta === null) {
    return 'none';
  }

  if (delta > 0) {
    return 'up';
  }

  return delta < 0 ? 'down' : 'flat';
}

/** KPIs where a lower value is the better one (days outstanding, scrap, absence, turnover). */
const LOWER_IS_BETTER = new Set([
  'dso',
  'scrap_rate',
  'absenteeism',
  'headcount_turnover',
  'overtime_trend',
  'vat_liability',
]);

export function isImprovement(kpiCode: string, delta: number | null): boolean | null {
  if (delta === null || delta === 0) {
    return null;
  }

  return LOWER_IS_BETTER.has(kpiCode) ? delta < 0 : delta > 0;
}

/**
 * The drill-down segment of a chart click. `name` is the category the user clicked (a month, a bucket, a stage), `seriesName`
 * the series (receivables or payables for the aging heatmap).
 */
export function segmentFor(
  widget: CockpitWidget,
  click: { name?: string; seriesName?: string; dataIndex?: number; value?: unknown },
): DrillSegment {
  const name = click.name ?? '';

  switch (widget.widget_type) {
    case 'area_trend':
      return /^\d{4}-\d{2}$/.test(name) ? { period: name } : {};
    case 'heatmap': {
      const value = Array.isArray(click.value) ? click.value : [];
      const bucket = BUCKET_KEYS[Number(value[0])];
      const side = Number(value[1]) === 0 ? 'receivable' : 'payable';

      return bucket === undefined ? {} : { bucket, side };
    }
    case 'funnel': {
      const stages = widget.data['stages'];
      const stage = Array.isArray(stages)
        ? (stages[click.dataIndex ?? -1] as { stage_id?: string | null })
        : null;

      return stage?.stage_id ? { stage_id: stage.stage_id } : {};
    }
    default:
      return {};
  }
}

/** A top-N row click: customers drill by contact, products by product. */
export function segmentForRow(widget: CockpitWidget, rowId: string): DrillSegment {
  return widget.data['dimension'] === 'product' ? { product_id: rowId } : { contact_id: rowId };
}

/** The rows of the Top-N table. */
export interface TopRow {
  id: string;
  name: string;
  revenue: number;
  margin_percent: number | null;
  share_percent: number | null;
}

export function topRows(widget: CockpitWidget): TopRow[] {
  const rows = widget.data['rows'];

  return Array.isArray(rows) ? (rows as TopRow[]) : [];
}
