import { TicketPriority } from './ticket.model';

/** SLA target a ticket is measured against. */
export type SlaTargetKind = 'response' | 'next_update' | 'resolution';
export type SlaTargetState = 'at_risk' | 'breached';
export type EscalationAction = 'notify' | 'reassign_team' | 'raise_priority';
export type MetricsGroupBy = 'queue' | 'priority' | 'contract';
export type HelpdeskContractKind = 'prepaid_hours' | 'flat_rate';
export type BillingStatus =
  'contract_deducted' | 'partially_deducted' | 'billable_pending' | 'non_billable';

/** Languages of canned responses and knowledge base articles. */
export const HELPDESK_LOCALES = ['it-CH', 'de-CH', 'fr-CH', 'en', 'it-IT'] as const;
export type HelpdeskLocale = (typeof HELPDESK_LOCALES)[number];

export const HOLIDAY_COUNTRIES = ['CH', 'IT'] as const;
export type HolidayCountry = (typeof HOLIDAY_COUNTRIES)[number];

/** Cantons and regions the API accepts for the holiday calendar of each country. */
export const HOLIDAY_REGIONS: Record<HolidayCountry, readonly string[]> = {
  CH: [
    'AG',
    'AI',
    'AR',
    'BE',
    'BL',
    'BS',
    'FR',
    'GE',
    'GL',
    'GR',
    'JU',
    'LU',
    'NE',
    'NW',
    'OW',
    'SG',
    'SH',
    'SO',
    'SZ',
    'TG',
    'TI',
    'UR',
    'VD',
    'VS',
    'ZG',
    'ZH',
  ],
  IT: [
    'ABR',
    'BAS',
    'CAL',
    'CAM',
    'EMR',
    'FVG',
    'LAZ',
    'LIG',
    'LOM',
    'MAR',
    'MOL',
    'PIE',
    'PUG',
    'SAR',
    'SIC',
    'TAA',
    'TOS',
    'UMB',
    'VDA',
    'VEN',
  ],
};

export interface BreachRiskTarget {
  target: SlaTargetKind;
  due_at: string | null;
  elapsed_percent: number;
  state: SlaTargetState;
}

export interface BreachRiskTicket {
  ticket_id: string;
  ticket_number: string;
  subject: string;
  priority: TicketPriority;
  status: string;
  customer_id: string | null;
  assigned_team_id: string | null;
  assigned_technician_id: string | null;
  risk_percent: number;
  targets: BreachRiskTarget[];
}

export interface BreachRiskParams {
  risk_percent?: number;
  limit?: number;
}

export interface CsatBreakdown {
  responses: number;
  average: number | null;
  distribution: Record<string, number>;
}

export interface HelpdeskMetricsGroup {
  key: string;
  tickets: number;
  mttfr_minutes: number | null;
  mttr_minutes: number | null;
  first_response_compliance_percent: number | null;
  resolution_compliance_percent: number | null;
  csat: CsatBreakdown;
}

export interface HelpdeskMetrics {
  period: { from: string; to: string } | null;
  group_by: MetricsGroupBy;
  totals: Record<string, number | null>;
  groups: HelpdeskMetricsGroup[];
}

export interface HelpdeskMetricsParams {
  from?: string;
  to?: string;
  group_by?: MetricsGroupBy;
}

export interface CustomerContract {
  id: string;
  name: string;
  kind: HelpdeskContractKind;
  included_hours: number | null;
  consumed_hours: number | null;
  remaining_hours: number | null;
  end_date: string | null;
}

export interface CustomerAsset {
  id: string;
  serial_number: string | null;
  warranty_expiry_date: string | null;
}

export interface CustomerOpenInvoices {
  count: number;
  overdue_count: number;
  total_gross: number;
}

export interface CustomerRecentTicket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string | null;
}

/** The 360 degree view of the customer of a ticket. */
export interface TicketCustomerContext {
  customer_id: string | null;
  contracts: CustomerContract[];
  assets: CustomerAsset[];
  open_invoices: CustomerOpenInvoices;
  recent_tickets: CustomerRecentTicket[];
}

export interface TicketEscalationLogEntry {
  id: string;
  chain_id: string | null;
  step_id: string | null;
  target: SlaTargetKind;
  threshold_percent: number;
  elapsed_percent: number;
  action: EscalationAction;
  outcome: string | null;
  fired_at: string | null;
}

export interface LogTicketTimeRequest {
  minutes: number;
  technician_id?: string | null;
  description?: string | null;
  is_billable?: boolean;
}

export interface TicketTimeEntry {
  id: string;
  hours: number;
  minutes: number;
  billing_status: BillingStatus;
  contract_hours: number;
  billable_hours: number;
  service_contract_id: string | null;
  total_charge: number | null;
  description?: string | null;
  created_at?: string | null;
}

export interface EscalationStepInput {
  target: SlaTargetKind;
  threshold_percent: number;
  action: EscalationAction;
  notify_user_ids?: string[];
  notify_team_lead?: boolean;
  team_id?: string | null;
  priority?: TicketPriority | null;
}

export interface EscalationStep extends EscalationStepInput {
  id: string;
}

export interface EscalationChain {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  steps: EscalationStep[];
}

export interface SaveEscalationChainRequest {
  code: string;
  name: string;
  is_active?: boolean;
  steps: EscalationStepInput[];
}

export interface SlaPolicySettingsRequest {
  escalation_chain_id?: string | null;
  next_update_interval_minutes?: number | null;
  pause_on_on_hold?: boolean;
}

export interface HolidayPreviewParams {
  country: HolidayCountry;
  region?: string;
  year?: number;
}

export interface HolidayPreview {
  country: HolidayCountry;
  region: string | null;
  year: number;
  dates: string[];
}

export interface HandoffToFieldServiceRequest {
  work_type?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  location_address?: string;
}

export interface HandoffToRmaRequest {
  serial_number?: string;
  equipment_passport_id?: string;
  goodwill?: boolean;
  reported_symptom?: string;
}

/** Outcome of a one-click escalation: `created` is false when the ticket was already handed off (HTTP 200). */
export interface HandoffResult<T> {
  created: boolean;
  data: T;
  meta?: { tracking_token?: string };
}

export interface HandoffWorkOrder {
  id: string;
  [key: string]: unknown;
}

export interface HandoffRma {
  id: string;
  [key: string]: unknown;
}
