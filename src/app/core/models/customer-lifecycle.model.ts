/** Touchpoint types of the customer 360 timeline (`GET /crm/customers/{id}/timeline`). */
export const TIMELINE_TYPES = [
  'activity',
  'opportunity',
  'invoice',
  'ticket',
  'work_order',
  'contract',
  'lead',
] as const;
export type TimelineType = (typeof TIMELINE_TYPES)[number];

export type ContractCoverage = 'none' | 'covered' | 'exhausted';

export interface CustomerLifecycleKpis {
  lifetime_value: string;
  open_pipeline_value: string;
  open_opportunities: number;
  overdue_receivable_amount: string;
  open_tickets: number;
  sla_breach_rate: number;
  mttr_hours: number | null;
  active_contracts: number;
  contract_coverage: ContractCoverage;
  contract_hours_remaining: string;
  contracts_expiring_soon: number;
  interventions_scheduled: number;
  interventions_completed: number;
}

export interface CustomerLifecycleSummary {
  account: { id: string; contact_id: string | null; name: string; tier: string | null; status: string | null };
  health: { health_index: number; churn_risk: string | null; last_interaction_at: string | null };
  kpis: CustomerLifecycleKpis;
}

export interface CustomerTimelineEvent {
  type: TimelineType;
  id: string;
  occurred_at: string;
  title: string;
  status: string | null;
  amount: string | null;
  reference: string | null;
  label: string;
}
