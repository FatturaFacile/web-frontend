/** Governance, risk and compliance (GRC): mirrors the FormRequests and resources of the API module Governance. */

export type GovRiskCategory =
  | 'strategic'
  | 'operational'
  | 'financial'
  | 'compliance'
  | 'it_security'
  | 'legal'
  | 'reputational'
  | 'environmental';
export type GovRiskTreatment = 'mitigate' | 'accept' | 'transfer' | 'avoid';
export type GovRiskStatus = 'identified' | 'assessed' | 'treating' | 'accepted' | 'closed';
export type GovRating = 'low' | 'medium' | 'high' | 'critical';
export type GovControlType = 'preventive' | 'detective' | 'corrective';
export type GovControlFrequency =
  | 'continuous'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'ad_hoc';
export type GovControlStatus = 'draft' | 'active' | 'retired';
export type GovTestResult = 'pass' | 'partial' | 'fail';
export type GovAuditPlanStatus = 'draft' | 'approved' | 'closed';
export type GovAuditType = 'process' | 'compliance' | 'it' | 'financial' | 'follow_up';
export type GovAuditStatus = 'planned' | 'in_progress' | 'reporting' | 'closed' | 'cancelled';
export type GovFindingSource = 'audit' | 'control_test' | 'self_assessment' | 'external';
export type GovSeverity = 'low' | 'medium' | 'high' | 'critical';
export type GovFindingStatus = 'open' | 'remediation' | 'resolved' | 'closed' | 'risk_accepted';
export type GovActionStatus = 'open' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
export type GovFramework = 'd_lgs_231' | 'gdpr' | 'nis2' | 'fadp' | 'iso_27001' | 'other';
export type GovJurisdiction = 'IT' | 'CH' | 'EU' | 'INT';
export type GovRecurrence = 'once' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type GovObligationStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface GovMemberReference {
  id: string;
  name: string;
}

export interface GovMember extends GovMemberReference {
  role: string;
}

export interface GovRisk {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  category: GovRiskCategory;
  likelihood: number;
  impact: number;
  inherent_score: number;
  inherent_rating: GovRating;
  residual_likelihood?: number | null;
  residual_impact?: number | null;
  residual_score?: number | null;
  residual_rating?: GovRating | null;
  treatment?: GovRiskTreatment | null;
  treatment_notes?: string | null;
  owner_id?: string | null;
  owner?: GovMemberReference | null;
  status: GovRiskStatus;
  next_review_date?: string | null;
  is_review_overdue: boolean;
  closed_at?: string | null;
  controls?: GovControl[];
  created_at?: string;
  updated_at?: string;
}

export interface GovRiskRequest {
  title: string;
  description?: string | null;
  category: GovRiskCategory;
  likelihood: number;
  impact: number;
  residual_likelihood?: number | null;
  residual_impact?: number | null;
  treatment?: GovRiskTreatment | null;
  treatment_notes?: string | null;
  owner_id?: string | null;
  next_review_date?: string | null;
}

export interface GovRiskControlsRequest {
  control_ids: string[];
}

export interface GovTransitionRequest {
  status: string;
  notes?: string | null;
}

export interface GovControl {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  control_type: GovControlType;
  frequency: GovControlFrequency;
  framework_reference?: string | null;
  owner_id?: string | null;
  owner?: GovMemberReference | null;
  status: GovControlStatus;
  last_tested_at?: string | null;
  last_test_result?: GovTestResult | null;
  next_test_due_date?: string | null;
  is_test_overdue: boolean;
  risk_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface GovControlRequest {
  title: string;
  description?: string | null;
  control_type: GovControlType;
  frequency: GovControlFrequency;
  framework_reference?: string | null;
  owner_id?: string | null;
  status?: GovControlStatus;
}

export interface GovControlTest {
  id: string;
  control_id: string;
  tested_on: string;
  tester_id?: string | null;
  tester?: GovMemberReference | null;
  result: GovTestResult;
  sample_size?: number | null;
  exceptions_found?: number | null;
  notes?: string | null;
  evidence_document_ids: string[];
  finding_id?: string | null;
  created_at?: string;
}

export interface GovControlTestRequest {
  tested_on: string;
  result: GovTestResult;
  sample_size?: number | null;
  exceptions_found?: number | null;
  notes?: string | null;
  evidence_document_ids?: string[] | null;
  raise_finding?: boolean;
}

export interface GovAuditPlan {
  id: string;
  year: number;
  title: string;
  description?: string | null;
  status: GovAuditPlanStatus;
  approved_at?: string | null;
  approved_by?: GovMemberReference | null;
  closed_at?: string | null;
  audits_count?: number;
  audits?: GovAudit[];
  created_at?: string;
  updated_at?: string;
}

export interface GovAuditPlanRequest {
  year: number;
  title: string;
  description?: string | null;
}

export interface GovAudit {
  id: string;
  audit_plan_id?: string | null;
  code: string;
  title: string;
  audit_type: GovAuditType;
  scope: string;
  objectives?: string | null;
  lead_auditor_id: string;
  lead_auditor?: GovMemberReference | null;
  team_member_ids: string[];
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  status: GovAuditStatus;
  conclusion?: string | null;
  is_late_to_start: boolean;
  findings_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GovAuditRequest {
  audit_plan_id?: string | null;
  title: string;
  audit_type: GovAuditType;
  scope: string;
  objectives?: string | null;
  lead_auditor_id: string;
  team_member_ids?: string[] | null;
  planned_start: string;
  planned_end: string;
  conclusion?: string | null;
}

export interface GovFinding {
  id: string;
  code: string;
  audit_id?: string | null;
  control_id?: string | null;
  risk_id?: string | null;
  source: GovFindingSource;
  title: string;
  description?: string | null;
  severity: GovSeverity;
  recommendation?: string | null;
  owner_id?: string | null;
  owner?: GovMemberReference | null;
  status: GovFindingStatus;
  accepted_reason?: string | null;
  accepted_at?: string | null;
  accepted_by?: GovMemberReference | null;
  closed_at?: string | null;
  closed_by?: GovMemberReference | null;
  closure_notes?: string | null;
  actions_count?: number;
  actions?: GovAction[];
  created_at?: string;
  updated_at?: string;
}

export interface GovFindingRequest {
  source: GovFindingSource;
  audit_id?: string | null;
  control_id?: string | null;
  risk_id?: string | null;
  title: string;
  description?: string | null;
  severity: GovSeverity;
  recommendation?: string | null;
  owner_id?: string | null;
}

export interface GovActionFindingSummary {
  id: string;
  code: string;
  title: string;
  severity: GovSeverity;
}

export interface GovAction {
  id: string;
  finding_id: string;
  code: string;
  title: string;
  description?: string | null;
  owner_id: string;
  owner?: GovMemberReference | null;
  due_date: string;
  status: GovActionStatus;
  is_overdue: boolean;
  completed_at?: string | null;
  completed_by?: GovMemberReference | null;
  completion_notes?: string | null;
  verified_at?: string | null;
  verified_by?: GovMemberReference | null;
  verification_notes?: string | null;
  finding?: GovActionFindingSummary | null;
  created_at?: string;
  updated_at?: string;
}

export interface GovActionRequest {
  title: string;
  description?: string | null;
  owner_id: string;
  due_date: string;
}

export interface GovObligation {
  id: string;
  template_key?: string | null;
  framework: GovFramework;
  jurisdiction: GovJurisdiction;
  title: string;
  description?: string | null;
  legal_reference?: string | null;
  recurrence: GovRecurrence;
  due_date: string;
  reminder_days: number;
  owner_id?: string | null;
  owner?: GovMemberReference | null;
  status: GovObligationStatus;
  is_overdue: boolean;
  is_due_soon: boolean;
  last_completed_at?: string | null;
  last_completed_by?: GovMemberReference | null;
  evidence_document_id?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GovObligationRequest {
  framework: GovFramework;
  jurisdiction: GovJurisdiction;
  title: string;
  description?: string | null;
  legal_reference?: string | null;
  recurrence: GovRecurrence;
  due_date: string;
  reminder_days?: number | null;
  owner_id?: string | null;
  evidence_document_id?: string | null;
  notes?: string | null;
}

export interface GovObligationCompleteRequest {
  completed_on?: string | null;
  evidence_document_id?: string | null;
  notes?: string | null;
}

export interface GovObligationTemplate {
  key: string;
  framework: GovFramework;
  jurisdiction: GovJurisdiction;
  title: string;
  description: string;
  legal_reference: string;
  recurrence: GovRecurrence;
  reminder_days: number;
  already_seeded: boolean;
}

export interface GovSeedObligationTemplatesRequest {
  frameworks: GovFramework[];
  first_due_date?: string | null;
  owner_id?: string | null;
}

export interface GovHeatmapCell {
  likelihood: number;
  impact: number;
  score: number;
  rating: GovRating;
  count: number;
}

export interface GovDashboard {
  as_of: string;
  basis: 'residual' | 'inherent';
  risks: {
    total: number;
    by_status: Record<GovRiskStatus, number>;
    by_rating: Record<GovRating, number>;
    review_overdue: number;
    heatmap: GovHeatmapCell[];
  };
  controls: {
    active: number;
    test_overdue: number;
    never_tested: number;
    tests_in_period: number;
    tests_by_result: Record<GovTestResult, number>;
    pass_rate: number | null;
    pass_rate_months: number;
  };
  findings: {
    open_total: number;
    open_by_severity: Record<GovSeverity, number>;
    risk_accepted: number;
  };
  actions: {
    open: number;
    overdue: number;
    due_next_30_days: number;
    awaiting_verification: number;
  };
  obligations: {
    open: number;
    overdue: number;
    due_next_30_days: number;
  };
  audits: {
    year: number;
    plan_status: GovAuditPlanStatus | null;
    plan_audits: number;
    plan_closed: number;
    plan_completion_rate: number | null;
    in_progress: number;
    late_to_start: number;
  };
}
