/** Budget control (Mod 019): grid, revisions, imports, volume/price variance and the spend lock. Mirrors the API of the Budgeting module. */

import { BudgetScenarioKind } from './budgeting.model';

export type SpendMode = 'allow' | 'warning' | 'hard_block';
export type SpendDocumentType = 'requisition' | 'purchase_order';
export type SpendStage = 'create' | 'submit' | 'approve';
export type SpendOutcome = 'ok' | 'warning' | 'overridden' | 'blocked';
export type CommitmentStatus = 'open' | 'closed' | 'released';
export type OverrideScope = 'document' | 'allowance';
export type OverrideStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'consumed';
export type ImportMode = 'replace' | 'merge';
export type ImportStatus = 'imported' | 'failed' | 'validated';
export type DecompositionGroup = 'account' | 'cost_center' | 'project';

export const SPEND_MODES: readonly SpendMode[] = ['allow', 'warning', 'hard_block'];
export const SPEND_DOCUMENT_TYPES: readonly SpendDocumentType[] = ['requisition', 'purchase_order'];
export const SPEND_STAGES: readonly SpendStage[] = ['create', 'submit', 'approve'];
export const OVERRIDE_STATUSES: readonly OverrideStatus[] = ['pending', 'approved', 'rejected', 'cancelled', 'consumed'];
export const OVERRIDE_SCOPES: readonly OverrideScope[] = ['document', 'allowance'];
export const IMPORT_MODES: readonly ImportMode[] = ['replace', 'merge'];
export const DECOMPOSITION_GROUPS: readonly DecompositionGroup[] = ['account', 'cost_center', 'project'];

/** Dimensions that narrow a variance or decomposition report. */
export interface BudgetDimensionFilters {
  account_id?: string | null;
  cost_center_id?: string | null;
  project_id?: string | null;
}

// Grid

export interface BudgetGridSlot {
  slot: number;
  label: string;
  from_period: number;
  to_period: number;
}

export interface BudgetGridCell {
  amount: string;
  quantity: string | null;
  unit_price: string | null;
}

export interface BudgetGridRow {
  key: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  cost_center_id: string | null;
  cost_center_code: string | null;
  cost_center_name: string | null;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  cells: Record<string, BudgetGridCell>;
  total: string;
}

export interface BudgetGrid {
  version_id: string;
  granularity: 'monthly' | 'quarterly';
  slots: BudgetGridSlot[];
  rows: BudgetGridRow[];
  totals: { total: string; slots: Record<string, string> };
}

export interface BudgetGridCellRequest {
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  slot: number;
  amount: string;
  quantity?: string | null;
  unit_price?: string | null;
  notes?: string | null;
}

// Revisions, scenarios, transfers, roll forward

export interface BudgetReviseRequest {
  name?: string | null;
  description?: string | null;
  reason: string;
}

export interface BudgetScenarioRequest {
  name: string;
  description?: string | null;
  scenario_kind: BudgetScenarioKind;
  adjustment_percent?: number | null;
}

export interface BudgetTransferEnd {
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
}

export interface BudgetTransferRequest {
  from: BudgetTransferEnd;
  to: BudgetTransferEnd;
  period: number;
  amount: string;
  comment?: string | null;
}

export interface BudgetRollForwardRequest {
  name?: string | null;
  shift_months?: number | null;
  adjustment_percent?: number | null;
}

export interface BudgetAuditEvent {
  id: string;
  subject_type: string;
  subject_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  user_id: string | null;
  comment: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// Import

export interface BudgetImportError {
  row: number;
  field: string;
  message: string;
}

export interface BudgetImport {
  id: string;
  version_id: string;
  file_name: string;
  format: string;
  mode: ImportMode;
  status: ImportStatus;
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  errors: BudgetImportError[];
  user_id: string | null;
  created_at: string;
}

// Volume and price variance

export interface BudgetDecompositionRow {
  key: string;
  code: string;
  label: string;
  budget: string;
  actual: string;
  variance: string;
  is_favorable: boolean;
  budget_quantity: string | null;
  actual_quantity: string | null;
  budget_price: string | null;
  actual_price: string | null;
  volume_variance: string | null;
  price_variance: string | null;
  decomposable: boolean;
}

export interface BudgetDecomposition {
  version_id: string;
  through_period: number;
  group_by: DecompositionGroup;
  rows: BudgetDecompositionRow[];
  totals: { budget: string; actual: string; variance: string; volume_variance: string; price_variance: string; undecomposed_variance: string };
}

export interface BudgetActualVolume {
  id: string;
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  month: string;
  quantity: string;
  notes: string | null;
}

export interface BudgetActualVolumeRequest {
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  month: string;
  quantity: string;
  notes?: string | null;
}

// Spend control

export interface BudgetAvailability {
  version_id: string | null;
  fiscal_year: number;
  has_budget: boolean;
  currency: string;
  budget: string;
  actual: string;
  committed: string;
  available: string;
  utilization_percent: string | null;
}

export interface SpendDecision {
  outcome: SpendOutcome;
  mode: SpendMode | null;
  rule_id: string | null;
  override_id: string | null;
  check_id: string | null;
  requested: string;
  shortfall: string;
  availability: BudgetAvailability;
}

export interface SpendCheckRequest {
  source_type: SpendDocumentType;
  stage?: SpendStage | null;
  amount: string;
  account_id?: string | null;
  cost_center_id?: string | null;
  project_id?: string | null;
  date?: string | null;
}

export interface AvailabilityFilters {
  date?: string | null;
  account_id?: string | null;
  cost_center_id?: string | null;
  project_id?: string | null;
}

export interface SpendRule {
  id: string;
  name: string;
  account_id: string | null;
  cost_center_id: string | null;
  project_id: string | null;
  mode: SpendMode;
  threshold_percent: string;
  document_types: SpendDocumentType[];
  stages: SpendStage[];
  enforce_without_budget: boolean;
  priority: number;
  is_active: boolean;
}

export interface SpendRuleRequest {
  name: string;
  account_id: string | null;
  cost_center_id: string | null;
  project_id: string | null;
  mode: SpendMode;
  threshold_percent: number;
  document_types: SpendDocumentType[];
  stages: SpendStage[];
  enforce_without_budget: boolean;
  priority: number;
  is_active: boolean;
}

export interface BudgetCommitment {
  id: string;
  source_type: SpendDocumentType;
  source_id: string;
  source_number: string | null;
  parent_source_id: string | null;
  account_id: string | null;
  cost_center_id: string | null;
  project_id: string | null;
  fiscal_year: number;
  period: number | null;
  commitment_date: string;
  currency: string;
  amount: string;
  consumed_amount: string;
  released_amount: string;
  open_amount: string;
  status: CommitmentStatus;
  release_reason: string | null;
}

export interface CommitmentFilters {
  status?: CommitmentStatus;
  source_type?: SpendDocumentType;
  fiscal_year?: number;
  cost_center_id?: string;
  project_id?: string;
  per_page?: number;
}

export interface SpendCheckLog {
  id: string;
  source_type: SpendDocumentType;
  source_id: string | null;
  source_number: string | null;
  stage: SpendStage;
  outcome: 'warning' | 'blocked' | 'overridden';
  rule_id: string | null;
  override_id: string | null;
  account_id: string | null;
  cost_center_id: string | null;
  project_id: string | null;
  fiscal_year: number;
  budget_amount: string;
  actual_amount: string;
  committed_amount: string;
  requested_amount: string;
  available_amount: string;
  projected_percent: string | null;
  user_id: string | null;
  message: string | null;
  created_at: string;
}

export interface SpendCheckFilters {
  outcome?: 'warning' | 'blocked' | 'overridden';
  source_type?: SpendDocumentType;
  source_id?: string;
  cost_center_id?: string;
  per_page?: number;
}

export interface BudgetSettings {
  amber_threshold_percent: string;
  red_threshold_percent: string;
  override_validity_days: number;
}

export interface BudgetOverride {
  id: string;
  scope: OverrideScope;
  source_type: SpendDocumentType | null;
  source_id: string | null;
  source_number: string | null;
  account_id: string | null;
  cost_center_id: string | null;
  project_id: string | null;
  fiscal_year: number;
  requested_amount: string;
  shortfall_amount: string;
  approved_amount: string | null;
  consumed_amount: string;
  remaining_amount: string;
  reason: string;
  status: OverrideStatus;
  is_expired: boolean;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  valid_until: string | null;
  created_at: string;
}

export interface BudgetOverrideRequest {
  scope: OverrideScope;
  source_type?: SpendDocumentType | null;
  source_id?: string | null;
  source_number?: string | null;
  account_id?: string | null;
  cost_center_id?: string | null;
  project_id?: string | null;
  requested_amount: string;
  reason: string;
  valid_until?: string | null;
  date?: string | null;
}

export interface BudgetOverrideDecisionRequest {
  comment?: string | null;
  approved_amount?: string | null;
  valid_until?: string | null;
}

export interface BudgetOverrideFilters {
  status?: OverrideStatus;
  scope?: OverrideScope;
  source_id?: string;
  per_page?: number;
}

