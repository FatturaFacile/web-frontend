/**
 * Supplier lifecycle and portal (API module `supplier_portal`, `/api/v1/supplier-portal`). Field names and enums mirror the
 * FormRequests and resources of web-api/modules/44_SupplierPortal.
 */

export type SupplierCountry = 'IT' | 'CH';

export type SupplierOnboardingStatus =
  | 'invited'
  | 'registration_submitted'
  | 'documents_required'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'blocked';

export type SupplierDocumentStatus = 'submitted' | 'accepted' | 'rejected' | 'superseded';

export type SupplierRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type SupplierBankChangeStatus = 'pending' | 'applied' | 'rejected' | 'cancelled';

export type SupplierCheckType =
  | 'vies_vat'
  | 'vat_status'
  | 'antimafia'
  | 'sanctions'
  | 'business_register'
  | 'durc_online'
  | 'other';

export type SupplierCheckResult = 'pending' | 'passed' | 'failed';

export interface SupplierPortalSummary {
  onboardings_by_status: Record<SupplierOnboardingStatus, number>;
  documents_to_review: number;
  documents_expiring: number;
  bank_changes_pending: number;
  suppliers_by_risk: Record<SupplierRiskLevel, number>;
}

export interface SupplierOnboarding {
  id: string;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_vat_number?: string | null;
  qualification_status?: string | null;
  status: SupplierOnboardingStatus;
  country: SupplierCountry;
  invitation_email?: string | null;
  invited_at?: string | null;
  registration?: Record<string, string | null> | null;
  registration_submitted_at?: string | null;
  documents_submitted_at?: string | null;
  review_started_at?: string | null;
  decided_at?: string | null;
  decision_notes?: string | null;
  status_reason?: string | null;
  allowed_transitions: SupplierOnboardingStatus[];
}

export interface SupplierInviteRequest {
  supplier_id: string;
  invitation_email?: string | null;
  country: SupplierCountry;
}

export interface SupplierOnboardingActionRequest {
  reason?: string | null;
  notes?: string | null;
}

export interface SupplierDocumentRequirement {
  id: string;
  code: string;
  name: string;
  country?: SupplierCountry | null;
  is_mandatory: boolean;
  requires_expiry: boolean;
  validity_days?: number | null;
  alert_days: number;
  is_active: boolean;
  sort_order: number;
}

export interface SupplierDocument {
  id: string;
  supplier_id: string;
  supplier_name?: string | null;
  onboarding_id?: string | null;
  requirement_id: string;
  requirement_code?: string | null;
  requirement_name?: string | null;
  is_mandatory?: boolean | null;
  status: SupplierDocumentStatus;
  reference?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  days_to_expiry?: number | null;
  is_expired: boolean;
  has_file: boolean;
  original_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  submitted_via: 'internal' | 'portal';
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  notes?: string | null;
}

export interface SupplierOnboardingBlocker {
  code: string;
  detail?: string | null;
}

export interface SupplierOnboardingRequirement extends SupplierDocumentRequirement {
  submission: SupplierDocument | null;
}

export interface SupplierQualificationCriterion {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  weight: string;
  max_score: number;
  is_active: boolean;
  sort_order: number;
}

export interface SupplierQualificationCriterionRequest {
  code: string;
  name: string;
  description?: string | null;
  weight: string;
  max_score?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface SupplierQualificationScore {
  criterion_id: string;
  criterion_code?: string | null;
  criterion_name?: string | null;
  weight?: string | null;
  max_score?: number | null;
  score: string;
  notes?: string | null;
}

export interface SupplierQualificationScoreInput {
  criterion_id: string;
  score: number | string;
  notes?: string | null;
}

export interface SupplierQualificationAssessment {
  id: string;
  supplier_id: string;
  onboarding_id?: string | null;
  status: 'draft' | 'completed';
  total_score?: string | null;
  band?: 'A' | 'B' | 'C' | null;
  outcome?: 'qualified' | 'conditional' | 'not_qualified' | null;
  completed_at?: string | null;
  notes?: string | null;
  scores?: SupplierQualificationScore[];
}

export interface SupplierQualificationAssessmentRequest {
  supplier_id: string;
  onboarding_id?: string | null;
  notes?: string | null;
  scores?: SupplierQualificationScoreInput[];
}

export interface SupplierRiskReason {
  code: string;
  points: number;
  detail?: string | null;
}

export interface SupplierRiskProfile {
  id: string;
  supplier_id: string;
  supplier_name?: string | null;
  level: SupplierRiskLevel;
  score: number;
  reasons: SupplierRiskReason[];
  evaluated_at?: string | null;
}

export interface SupplierCheck {
  id: string;
  supplier_id: string;
  check_type: SupplierCheckType;
  result: SupplierCheckResult;
  checked_at?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface SupplierCheckRequest {
  supplier_id: string;
  check_type: SupplierCheckType;
  result: SupplierCheckResult;
  checked_at?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface SupplierOnboardingDetail {
  onboarding: SupplierOnboarding;
  requirements: SupplierOnboardingRequirement[];
  blockers: SupplierOnboardingBlocker[];
  assessment: SupplierQualificationAssessment | null;
  risk: SupplierRiskProfile | null;
}

export interface SupplierBankChangeApproval {
  user_id: string;
  decision: 'approved' | 'rejected';
  comment?: string | null;
  decided_at: string;
}

export interface SupplierBankChange {
  id: string;
  supplier_id: string;
  supplier_name?: string | null;
  source: 'internal' | 'portal';
  requested_by?: string | null;
  account_holder: string;
  iban: string;
  bic?: string | null;
  bank_name?: string | null;
  previous_iban?: string | null;
  reason?: string | null;
  status: SupplierBankChangeStatus;
  callback_verified_at?: string | null;
  callback_verified_by?: string | null;
  callback_note?: string | null;
  approvals_required: number;
  approvals?: SupplierBankChangeApproval[];
  decided_at?: string | null;
  applied_at?: string | null;
  rejection_reason?: string | null;
}

export interface SupplierBankChangeRequest {
  supplier_id: string;
  account_holder: string;
  iban: string;
  bic?: string | null;
  bank_name?: string | null;
  reason?: string | null;
}

export interface SupplierBankChangeDecisionRequest {
  note?: string | null;
  comment?: string | null;
  reason?: string | null;
}

export interface SupplierRfqSummary {
  id: string;
  rfq_number: string;
  title: string;
  status: 'issued' | 'awarded' | 'cancelled';
  response_deadline: string;
  is_open: boolean;
  currency: string;
  invited_count: number;
  responded_count: number;
  declined_count: number;
}

export interface SupplierRfqComparisonQuote {
  quote_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_rating?: string | null;
  total_amount: string;
  lead_time_days?: number | null;
  valid_until?: string | null;
  lines_quoted: number;
  covers_all_lines: boolean;
  status: string;
  risk_level: SupplierRiskLevel;
}

export interface SupplierRfqComparisonOffer {
  quote_id: string;
  supplier_id: string;
  unit_price: string;
  line_total: string;
  lead_time_days?: number | null;
}

export interface SupplierRfqComparisonLine {
  rfq_line_id: string;
  description: string;
  quantity: string;
  offers: SupplierRfqComparisonOffer[];
  best_unit_price?: string | null;
}

export interface SupplierRfqInvitation {
  supplier_id: string;
  supplier_name?: string | null;
  qualification_status?: string | null;
  risk_level: SupplierRiskLevel;
  status: 'invited' | 'responded' | 'declined';
  invited_at?: string | null;
  responded_at?: string | null;
}

export interface SupplierRfqComparison {
  rfq: Pick<SupplierRfqSummary, 'id' | 'rfq_number' | 'title' | 'status' | 'response_deadline' | 'is_open' | 'currency'>;
  lines: SupplierRfqComparisonLine[];
  quotes: SupplierRfqComparisonQuote[];
  invitations: SupplierRfqInvitation[];
  recommended_quote_id?: string | null;
  awarded_quote_id?: string | null;
}
