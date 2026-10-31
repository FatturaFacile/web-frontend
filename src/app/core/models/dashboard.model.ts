export interface KpiSummary {
  revenue_month: number;
  revenue_ytd: number;
  open_receivables: number;
  open_payables: number;
  pending_invoices_count: number;
  active_alerts_count: number;
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
