import { Cockpit, CockpitWidget, DrillDown } from './kpi-dashboards.models';

export function widgetFixture(overrides: Partial<CockpitWidget> = {}): CockpitWidget {
  return {
    widget_id: 'w-1',
    kpi_code: 'ebitda',
    role_code: 'ceo',
    widget_type: 'waterfall_chart',
    sort_order: 0,
    position: { x: 0, y: 0, w: 4, h: 3 },
    drill_down_route_template: null,
    source_document_type: 'journal_entries',
    value: 40000,
    comparison: { mode: 'yoy', prior_value: 30000, delta: 10000, delta_percent: 33.33 },
    fx_applied: { kind: 'average', rate: 1, available: true },
    alerts: [],
    data: {
      unit: 'currency',
      waterfall: [
        { step: 'revenue', amount: 100000 },
        { step: 'cogs', amount: -40000 },
        { step: 'opex', amount: -20000 },
        { step: 'ebitda', amount: 40000, is_total: true },
      ],
    },
    ...overrides,
  };
}

export function cockpitFixture(widgets: CockpitWidget[] = [widgetFixture()]): Cockpit {
  const rate = {
    rate: 1,
    kind: 'average' as const,
    from: 'CHF',
    to: 'CHF',
    as_of: null,
    available: true,
  };

  return {
    dashboard: {
      id: 'd-1',
      role_code: 'ceo',
      title_key: 'KPI_DASHBOARDS.DASHBOARD_CEO',
      custom_title: null,
      layout_grid: { columns: 12, row_height: 80 },
      refresh_interval_seconds: 300,
      is_system_default: true,
      version: 1,
    },
    filter: {
      from: '2026-01-01',
      to: '2026-06-30',
      comparison: 'yoy',
      company_ids: [],
      cost_center_ids: [],
      display_currency: 'CHF',
      include_intercompany_eliminations: false,
    },
    fx: { average: rate, closing: { ...rate, kind: 'closing' } },
    widgets,
    generated_at: '2026-06-30T10:00:00+00:00',
  };
}

export function drillFixture(): DrillDown {
  return {
    kpi_code: 'ebitda',
    document_type: 'journal_entries',
    breadcrumb: ['CEO', 'ebitda', 'period: 2026-02', 'currency: CHF'],
    columns: ['entry_number', 'debit'],
    rows: [{ entry_number: 'JE-1', debit: 10 }],
    pagination: { page: 1, per_page: 25, total: 1, last_page: 1 },
    deep_link: { route: '/general-ledger/journal-entries', query: { period: '2026-02' } },
  };
}
