import { ApiResponse } from './api.models';

/** Languages of the quote PDF and of the online signature page. */
export type CpqLocale = 'it' | 'en' | 'de' | 'fr';

export const CPQ_LOCALES: readonly CpqLocale[] = ['it', 'en', 'de', 'fr'];

export type CpqSimulationMode = 'discount_percent' | 'target_margin_percent' | 'target_total_price';

/** Decimal figures arrive as strings; a margin percentage is null when the net price is zero. */
export interface CpqMarginTotals {
  list_total: string;
  line_discount_total: string;
  global_discount_percent: string;
  global_discount_amount: string;
  surcharge_amount: string;
  net_total: string;
  cost_total: string;
  margin_amount: string;
  margin_percent: string | null;
}

export interface CpqMarginLine {
  list_total: string;
  discount_percentage: string;
  net_total: string;
  cost_total: string;
  margin_amount: string;
  margin_percent: string | null;
}

export interface CpqMarginResult {
  lines: CpqMarginLine[];
  totals: CpqMarginTotals;
}

export interface CpqSimulationRequest {
  mode: CpqSimulationMode;
  value: number;
  surcharge_amount?: number | null;
  setup_cost?: number | null;
  cost_exchange_rate?: number | null;
}

export interface CpqSimulationResult {
  mode: CpqSimulationMode;
  current: CpqMarginTotals;
  simulated: CpqMarginTotals;
  global_discount_percent: string;
  achievable: boolean;
}

export interface CpqRevisionSummary {
  id: string;
  quote_number: string;
  revision_number: number;
  status: string;
  is_current_revision: boolean;
  revision_notes: string | null;
  total_net: string;
  total_gross: string;
  created_at: string | null;
}

export interface CpqDiffHeader {
  id: string;
  quote_number: string;
  revision_number: number;
  status: string;
  revision_notes: string | null;
}

export interface CpqDiffLine {
  description: string;
  product_id: string | null;
  quantity: string;
  unit_price: string;
  discount_percentage: string;
  line_total: string;
}

export interface CpqDiffChange {
  from: string | number | boolean | Record<string, unknown> | null;
  to: string | number | boolean | Record<string, unknown> | null;
}

export interface CpqDiffModifiedLine {
  description: string;
  product_id: string | null;
  changes: Record<string, CpqDiffChange>;
}

export interface CpqDiffTotal {
  from: string | null;
  to: string | null;
  delta: string | null;
}

export interface CpqRevisionDiff {
  from: CpqDiffHeader;
  to: CpqDiffHeader;
  items: { added: CpqDiffLine[]; removed: CpqDiffLine[]; modified: CpqDiffModifiedLine[] };
  /** Cost and margin entries are absent for the roles that do not see costs. */
  totals: Record<string, CpqDiffTotal>;
}

export type CpqApprovalStatus = 'pending' | 'approved' | 'rejected';

export type CpqApprovalTriggerType = 'max_line_discount_percent' | 'max_global_discount_percent' | 'min_margin_percent';

export interface CpqApprovalTrigger {
  type: CpqApprovalTriggerType;
  limit: string;
  actual: string;
}

export interface CpqApprovalRequest {
  id: string;
  quote_id: string;
  level: number;
  required_role: string;
  status: CpqApprovalStatus;
  triggers: CpqApprovalTrigger[];
  requested_by: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
}

export interface CpqApprovalBreach {
  level: number;
  role: string;
  triggers: CpqApprovalTrigger[];
}

export interface CpqApprovalOverview {
  evaluation: { required_level: number; breaches: CpqApprovalBreach[]; figures?: CpqMarginTotals };
  cleared: boolean;
  requests: CpqApprovalRequest[];
}

export interface CpqApprovalTier {
  id: string;
  level: number;
  name: string;
  approver_role: string;
  max_line_discount_percent: string | null;
  max_global_discount_percent: string | null;
  min_margin_percent: string | null;
  is_active: boolean;
}

export interface CpqApprovalTierRequest {
  level: number;
  name: string;
  approver_role: string;
  max_line_discount_percent?: number | null;
  max_global_discount_percent?: number | null;
  min_margin_percent?: number | null;
  is_active?: boolean;
}

export type CpqSignatureStatus = 'pending' | 'signed' | 'changes_requested' | 'revoked';

export interface CpqSignatureRequest {
  id: string;
  quote_id: string;
  locale: CpqLocale;
  status: CpqSignatureStatus;
  expires_at: string;
  signer_name: string | null;
  signer_role: string | null;
  purchase_order_number: string | null;
  signature_type: 'drawn' | 'typed' | null;
  selected_optional_item_ids: string[];
  change_request: string | null;
  signed_at: string | null;
  ip_address: string | null;
  payload_hash: string | null;
  pdf_hash: string | null;
}

export interface CpqSignatureLink {
  request: CpqSignatureRequest;
  token: string;
  url: string;
}

export interface CpqSignatureVerification {
  valid: boolean;
  expected_hash: string | null;
  actual_hash: string;
}

export interface CpqPublicQuoteLine {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  discount_percentage: string;
  line_total: string;
  is_optional: boolean;
  is_selected: boolean;
  specs: string[];
}

export interface CpqPublicQuote {
  quote_number: string;
  date: string | null;
  valid_until: string | null;
  currency: string;
  status: string;
  allow_optional_selection: boolean;
  total_net: string;
  total_tax: string;
  total_gross: string;
  items: CpqPublicQuoteLine[];
}

export interface CpqPublicSigningView {
  locale: CpqLocale;
  expires_at: string;
  quote: CpqPublicQuote;
}

export interface CpqSignRequest {
  signer_name: string;
  signer_role: string;
  purchase_order_number?: string | null;
  signature_type: 'drawn' | 'typed';
  signature_data: string;
  selected_optional_item_ids?: string[] | null;
  accept_terms: true;
}

export type CpqEnvelope<T> = ApiResponse<T>;
