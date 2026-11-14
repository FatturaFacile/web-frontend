export interface KpiSummaryTenant {
  id: string | null;
  name: string | null;
  country: 'IT' | 'CH' | null;
  currency: string | null;
}

export interface KpiSummaryKpis {
  total_revenue: number | null;
  total_unpaid: number | null;
  invoices_count: number | null;
  active_currency: string | null;
}

/** `data` of GET /dashboard/kpi-summary. Fields are nullable because the frontend must not trust the envelope. */
export interface KpiSummary {
  tenant: KpiSummaryTenant | null;
  kpis: KpiSummaryKpis | null;
  metrics_timestamp: string | null;
}

export interface CashFlowForecastPoint {
  date: string;
  projected_inflow: number;
  projected_outflow: number;
  net_cash_flow: number;
  projected_balance: number;
}

export interface TaxDeadline {
  id: string;
  title: string;
  due_date: string;
  jurisdiction: 'IT' | 'CH';
  status: 'upcoming' | 'due' | 'completed';
  amount?: number;
}
