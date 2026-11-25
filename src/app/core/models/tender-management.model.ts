/**
 * Wire types of the tender management module (Mod 169, Issue #415), served under `/api/v1/tender-management`.
 * Amounts and percentages travel as decimal strings (a number is accepted on input); instants as ISO 8601.
 */

export type TndDecimal = string | number;

export const TND_JURISDICTIONS = [
  'CH_SIMAP_LAPub',
  'IT_Dlgs36_2023_ANAC',
  'EU_TED',
  'PrivateRfp',
] as const;
export type TndJurisdiction = (typeof TND_JURISDICTIONS)[number];

export const TND_PROCEDURE_TYPES = ['open', 'selective', 'invitation', 'direct_award'] as const;
export type TndProcedureType = (typeof TND_PROCEDURE_TYPES)[number];

export const TND_AWARD_CRITERIA = ['OEPV_MostEconomicallyAdvantageous', 'LowestPrice'] as const;
export type TndAwardCriterion = (typeof TND_AWARD_CRITERIA)[number];

export const TND_FORMULA_TYPES = ['Linear', 'Bilinear', 'Interpolation'] as const;
export type TndFormulaType = (typeof TND_FORMULA_TYPES)[number];

export const TND_NOTICE_STATUSES = ['open', 'closed', 'awarded', 'cancelled'] as const;
export type TndNoticeStatus = (typeof TND_NOTICE_STATUSES)[number];

export const TND_PARTICIPATION_MODES = [
  'SingleCompany',
  'RTI_Consorzio_Mandataria_Mandante',
  'Avvalimento',
] as const;
export type TndParticipationMode = (typeof TND_PARTICIPATION_MODES)[number];

export const TND_PARTICIPATION_STATUSES = [
  'Scouting',
  'GoApproved',
  'PreparingEnvelopes',
  'Submitted',
  'AwardedWon',
  'Lost',
  'LegalAppeal_Ricorso',
] as const;
export type TndParticipationStatus = (typeof TND_PARTICIPATION_STATUSES)[number];

export const TND_VERIFICATION_STATUSES = [
  'Valid',
  'ExpiringSoon',
  'Expired',
  'PendingRenewal',
] as const;
export type TndVerificationStatus = (typeof TND_VERIFICATION_STATUSES)[number];

export const TND_VAULT_DOC_TYPES = [
  'IT_SOA_Attestation',
  'IT_DURC',
  'IT_VisuraCamerale',
  'IT_CasellarioGiudiziale_CarichiPendenti',
  'IT_ISO9001',
  'IT_ISO14001',
  'IT_ISO45001',
  'IT_UNI_PdR_125_ParitaGenere',
  'IT_EMAS',
  'IT_PMI_Status',
  'CH_EstrattoEsecuzioniFallimenti_Betreibungsauszug',
  'CH_AttestatoAVS_AI_IPG',
  'CH_AttestatoSUVA',
  'CH_AttestatoLPP',
  'CH_AttestatoAFC_IVA',
  'CH_RispettoCCL',
  'CH_ParitaSalarialeLogib',
] as const;
export type TndVaultDocType = (typeof TND_VAULT_DOC_TYPES)[number];

export const TND_ENVELOPES = ['administrative', 'technical', 'economic'] as const;
export type TndEnvelopeKey = (typeof TND_ENVELOPES)[number];

export const TND_ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type TndAlertSeverity = (typeof TND_ALERT_SEVERITIES)[number];

export const TND_ALERT_TYPES = [
  'submission_deadline',
  'clarification_deadline',
  'vault_expiry',
  'soa_milestone',
  'betreibungsauszug_age',
] as const;
export type TndAlertType = (typeof TND_ALERT_TYPES)[number];

export const TND_DECISIONS = ['go', 'conditional', 'no_go'] as const;
export type TndDecision = (typeof TND_DECISIONS)[number];

export const TND_SIGNATURE_STATUSES = ['valid', 'invalid', 'unsigned', 'not_required'] as const;
export type TndSignatureStatus = (typeof TND_SIGNATURE_STATUSES)[number];

export const TND_SIGNATURE_FORMATS = ['p7m', 'pades', 'none', 'unknown'] as const;
export type TndSignatureFormat = (typeof TND_SIGNATURE_FORMATS)[number];

export const TND_ITEM_STATUSES = ['missing', 'uploaded', 'signature_invalid', 'ok'] as const;
export type TndItemStatus = (typeof TND_ITEM_STATUSES)[number];

export const TND_PARTNER_ROLES = ['mandataria', 'mandante', 'ausiliaria'] as const;
export type TndPartnerRole = (typeof TND_PARTNER_ROLES)[number];

export const TND_ERROR_CODES = [
  'invalid_transition',
  'participation_exists',
  'notice_closed',
  'deadline_passed',
  'envelopes_incomplete',
  'readiness_blocked',
  'safety_costs_required',
  'labor_costs_required',
  'bid_bond_percentage_invalid',
  'discount_out_of_range',
  'formula_required',
  'not_awarded',
  'already_converted',
  'contracting_authority_contact_required',
  'project_manager_required',
  'invalid_signature_format',
  'signature_invalid',
  'vault_file_required',
  'document_type_jurisdiction_mismatch',
  'unknown_envelope',
  'unknown_envelope_document',
  'edgue_unsupported_jurisdiction',
  'simap_payload_invalid',
  'file_too_large',
] as const;

export const TND_COMPLIANCE_CODES = [
  'art108_safety_costs_missing',
  'art108_labor_costs_missing',
  'art108_labor_costs_below_estimate',
  'cig_missing',
  'cup_missing',
  'rup_missing',
  'dedicated_account_missing',
  'soa_missing',
  'soa_expired',
  'soa_category_missing',
  'soa_classification_insufficient',
  'soa_intermediate_check_due',
  'fvoe_not_synced',
  'durc_missing',
  'durc_expired',
  'edgue_missing',
  'bid_bond_missing',
  'bid_bond_percentage_invalid',
  'anac_contribution_receipt_missing',
  'document_missing',
  'document_expired',
  'document_expiring',
  'betreibungsauszug_missing',
  'betreibungsauszug_too_old',
  'logib_missing',
  'logib_deviation_exceeded',
  'simap_number_missing',
  'clarification_deadline_passed',
  'submission_deadline_passed',
  'turnover_gap',
  'similar_projects_gap',
  'anomaly_threshold_exceeded',
  'offer_below_cost',
  'margin_negative',
  'rti_recommended',
  'avvalimento_recommended',
  'solo_eligible',
  'signature_invalid',
] as const;

export interface TndEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface TndPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface TndPage<T> extends TndEnvelope<T[]> {
  meta: TndPageMeta;
}

/** RFC 7807 problem; `code` is the suffix of `tenderManagement.error.<code>`. */
export interface TndProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  params?: Record<string, string | number>;
  errors?: Record<string, string[]>;
}

/** A compliance finding: `code` is the suffix of `tenderManagement.compliance.<code>`. */
export interface TndIssue {
  code: string;
  severity: 'blocking' | 'warning' | 'info';
  /** The envelope the finding belongs to (readiness issues), null when it concerns the dossier. */
  envelope?: TndEnvelopeKey | null;
  params?: Record<string, string | number>;
}

export interface TndSoaRequirement {
  category: string;
  classification: string;
}

export interface TndNotice {
  id: string;
  title: string;
  description: string | null;
  jurisdiction: TndJurisdiction;
  procedure_type: TndProcedureType;
  contracting_authority_name: string;
  contracting_authority_contact_id: string | null;
  simap_project_number: string | null;
  cig_code_it: string | null;
  cup_code_it: string | null;
  rup_name: string | null;
  dedicated_bank_account_it: string | null;
  cpv_category_codes: string[];
  award_criterion: TndAwardCriterion;
  formula_type: TndFormulaType | null;
  currency: string;
  base_auction_amount: string;
  non_subject_safety_costs_amount: string;
  estimated_labor_cost_amount: string;
  technical_max_score: string | null;
  economic_max_score: string | null;
  required_soa_categories: TndSoaRequirement[];
  required_min_turnover: string | null;
  turnover_reference_years: number;
  required_similar_projects_count: number;
  required_similar_projects_amount: string | null;
  required_certifications: string[];
  publication_date: string | null;
  clarification_deadline_at: string | null;
  submission_peremptory_deadline_at: string | null;
  status: TndNoticeStatus;
  participations_count?: number;
}

export interface TndNoticePayload {
  title: string;
  description?: string | null;
  jurisdiction: TndJurisdiction;
  procedure_type: TndProcedureType;
  contracting_authority_name: string;
  contracting_authority_contact_id?: string | null;
  simap_project_number?: string | null;
  cig_code_it?: string | null;
  cup_code_it?: string | null;
  rup_name?: string | null;
  dedicated_bank_account_it?: string | null;
  cpv_category_codes?: string[];
  award_criterion: TndAwardCriterion;
  formula_type?: TndFormulaType | null;
  currency?: string;
  base_auction_amount: TndDecimal;
  non_subject_safety_costs_amount?: TndDecimal;
  estimated_labor_cost_amount?: TndDecimal;
  technical_max_score?: TndDecimal | null;
  economic_max_score?: TndDecimal | null;
  required_soa_categories?: TndSoaRequirement[];
  required_min_turnover?: TndDecimal | null;
  turnover_reference_years?: number;
  required_similar_projects_count?: number;
  required_similar_projects_amount?: TndDecimal | null;
  required_certifications?: string[];
  publication_date?: string | null;
  clarification_deadline_at?: string | null;
  submission_peremptory_deadline_at?: string | null;
}

export interface TndNoticeFilters {
  q?: string;
  jurisdiction?: TndJurisdiction;
  status?: TndNoticeStatus;
  per_page?: number;
  page?: number;
}

export interface TndNoticeSummary {
  id: string;
  title: string;
  jurisdiction: TndJurisdiction;
  contracting_authority_name: string;
  base_auction_amount: string;
  currency: string;
  submission_peremptory_deadline_at: string | null;
  clarification_deadline_at: string | null;
  cig_code_it: string | null;
  simap_project_number: string | null;
  award_criterion: TndAwardCriterion;
  formula_type: TndFormulaType | null;
}

export interface TndPartner {
  name: string;
  vat_number?: string | null;
  role: TndPartnerRole;
  quota_percentage?: TndDecimal | null;
  soa_categories?: string[];
}

export interface TndEnvelopeItemSignature {
  format: TndSignatureFormat;
  status: TndSignatureStatus;
  signer: string | null;
  signed_at: string | null;
  verified_at: string | null;
  message_code: string | null;
}

export interface TndEnvelopeItem {
  key: string;
  label: string;
  required: boolean;
  signature_required: boolean;
  file_name: string | null;
  sha256: string | null;
  uploaded_at: string | null;
  status: TndItemStatus;
  signature: TndEnvelopeItemSignature | null;
}

export interface TndChecklistDefinition {
  key: string;
  label?: string;
  required: boolean;
  signature_required: boolean;
}

export interface TndReadinessEnvelope {
  complete: boolean;
  items: TndEnvelopeItem[];
}

export interface TndReadiness {
  ready: boolean;
  envelopes: Record<TndEnvelopeKey, TndReadinessEnvelope>;
  issues: TndIssue[];
}

export interface TndParticipation {
  id: string;
  tender_id: string;
  participation_mode: TndParticipationMode;
  rti_quota_percentage: string | null;
  partner_companies: TndPartner[] | null;
  go_no_go_score: TndEligibility | null;
  provisional_bid_bond_id: string | null;
  bid_bond_base_percentage: string | null;
  bid_bond_applied_reductions: TndBondReduction[] | null;
  bid_bond_final_amount: string | null;
  anac_contribution_receipt_id: string | null;
  anac_contribution_amount: string | null;
  administrative_envelope_docs: TndEnvelopeItem[] | null;
  technical_envelope_docs: TndEnvelopeItem[] | null;
  technical_envelope_score_target: string | null;
  economic_envelope_docs: TndEnvelopeItem[] | null;
  economic_discount_percentage_offered: string | null;
  offered_amount: string | null;
  estimated_total_cost: string | null;
  net_margin_amount: string | null;
  company_safety_costs_declared: string | null;
  company_labor_costs_declared: string | null;
  offer_simulation: TndOfferResult | null;
  submitted_at: string | null;
  status: TndParticipationStatus;
  converted_contract_id: string | null;
  converted_project_job_id: string | null;
  converted_at: string | null;
  notes: string | null;
  notice?: TndNoticeSummary;
  created_at?: string;
}

export interface TndParticipationDetail extends Omit<TndParticipation, 'notice'> {
  notice: TndNotice;
  allowed_transitions: TndParticipationStatus[];
}

export interface TndParticipationFilters {
  status?: TndParticipationStatus;
  jurisdiction?: TndJurisdiction;
  q?: string;
  per_page?: number;
  page?: number;
}

export interface TndParticipationPayload {
  participation_mode?: TndParticipationMode;
  rti_quota_percentage?: TndDecimal | null;
  partner_companies?: TndPartner[];
  notes?: string | null;
  provisional_bid_bond_id?: string | null;
  anac_contribution_receipt_id?: string | null;
  technical_envelope_score_target?: TndDecimal | null;
}

export interface TndCriterion {
  key: string;
  category: 'financial' | 'technical' | 'qualification' | 'certification' | 'compliance';
  required: string | number | null;
  available: string | number | null;
  met: boolean;
  gap: string | number | null;
  weight: number;
  score: number;
  document_id: string | null;
}

export interface TndSoaGap {
  category: string;
  required_classification: string;
  available_classification: string | null;
  met: boolean;
}

export interface TndEligibility {
  participation_id: string;
  strategy: string;
  can_bid_solo: boolean;
  recommended_mode: TndParticipationMode;
  overall_score: number;
  decision: TndDecision;
  criteria: TndCriterion[];
  gaps: {
    turnover_gap: string | number | null;
    similar_projects_gap: number | null;
    soa: TndSoaGap[];
    missing_certifications: string[];
    rti_quota_percentage_suggested: string | number | null;
  };
  issues: TndIssue[];
}

export interface TndOfferPayload {
  discount_percentage: TndDecimal;
  estimated_total_cost?: TndDecimal | null;
  other_direct_costs?: TndDecimal | null;
  company_safety_costs_declared: TndDecimal;
  company_labor_costs_declared: TndDecimal;
  bid_base_percentage: TndDecimal;
  technical_score_estimate?: TndDecimal | null;
  best_competitor_discount?: TndDecimal | null;
  competitor_discounts?: TndDecimal[];
  persist?: boolean;
}

export interface TndBondReduction {
  key: string;
  doc_type: string;
  percentage: string;
  document_id: string | null;
}

export interface TndAnomaly {
  is_anomalous: boolean;
  threshold_type: 'oepv_four_fifths' | 'average_discount' | null;
  threshold_value: string | number | null;
  message_code: string | null;
}

export interface TndScoring {
  criterion: TndAwardCriterion;
  formula: TndFormulaType | null;
  technical_score: string | number;
  technical_max: string | number;
  economic_score: string | number;
  economic_max: string | number;
  total_score: string | number;
  best_discount_assumed: string | number | null;
  anomaly: TndAnomaly;
}

export interface TndBidBond {
  base_percentage: string;
  base_amount: string;
  reductions: TndBondReduction[];
  final_amount: string;
  total_reduction_percentage: string;
}

export interface TndOfferResult {
  discount_percentage: string | number;
  base_auction_amount: string;
  discountable_base: string;
  non_subject_safety_costs_amount: string;
  offered_amount: string;
  estimated_total_cost: string;
  net_margin_amount: string;
  net_margin_percentage: string;
  company_safety_costs_declared: string;
  company_labor_costs_declared: string;
  scoring: TndScoring;
  bid_bond: TndBidBond;
  anac_contribution_amount: string | null;
  issues: TndIssue[];
  submission_blocked: boolean;
}

export interface TndVaultTypeInfo {
  value: TndVaultDocType;
  jurisdiction: 'IT' | 'CH';
  bond_reduction_key: string | null;
  max_age_months: number | null;
}

export interface TndEnvelopeTemplateItem {
  key: string;
  required: boolean;
  signature_required: boolean;
}

export interface TndLookups {
  jurisdictions: TndJurisdiction[];
  procedure_types: TndProcedureType[];
  award_criteria: TndAwardCriterion[];
  formula_types: TndFormulaType[];
  participation_modes: TndParticipationMode[];
  participation_statuses: TndParticipationStatus[];
  verification_statuses: TndVerificationStatus[];
  vault_doc_types: TndVaultTypeInfo[];
  envelopes: TndEnvelopeKey[];
  transitions: Record<string, TndParticipationStatus[]>;
  soa_categories: string[];
  soa_classifications: string[];
  bid_bond: { allowed_base_percentages: string[]; reductions: Record<string, string> };
  scoring: { technical_max_default: string; economic_max_default: string };
  envelope_templates: Record<
    'IT' | 'CH',
    Record<TndEnvelopeKey, TndEnvelopeTemplateItem[]>
  >;
}

export interface TndVaultDocument {
  id: string;
  doc_type: TndVaultDocType;
  jurisdiction: 'IT' | 'CH';
  title: string | null;
  document_number: string | null;
  issuing_body: string | null;
  soa_categories_classifications: TndSoaRequirement[] | null;
  issue_date: string | null;
  expiry_date: string | null;
  intermediate_triennial_check_date: string | null;
  fvoe20_synced: boolean;
  fvoe20_synced_at: string | null;
  numeric_value: string | null;
  file_name: string | null;
  has_file: boolean;
  verification_status: TndVerificationStatus;
  days_to_expiry: number | null;
  effective_expiry_date: string | null;
  renewed_from_id: string | null;
  notes: string | null;
}

export interface TndVaultFilters {
  doc_type?: TndVaultDocType;
  jurisdiction?: 'IT' | 'CH';
  verification_status?: TndVerificationStatus;
  per_page?: number;
  page?: number;
}

export interface TndVaultSegment {
  documents: TndVaultDocument[];
  summary: Record<TndVerificationStatus, number>;
  missing_types: TndVaultDocType[];
}

export interface TndVaultOverview {
  it: TndVaultSegment;
  ch: TndVaultSegment;
  fvoe: { synced: number; total: number };
}

export interface TndBenchmark {
  id: string;
  competitor_name: string;
  contracting_authority_name: string;
  cpv_code: string | null;
  jurisdiction: TndJurisdiction | null;
  award_date: string | null;
  base_auction_amount: string | null;
  awarded_amount: string | null;
  offered_discount_percentage: string | null;
  technical_score: string | null;
  economic_score: string | null;
  total_score: string | null;
  is_winner: boolean;
  source: string | null;
  notes: string | null;
}

export type TndBenchmarkPayload = Omit<TndBenchmark, 'id'>;

export interface TndBenchmarkFilters {
  q?: string;
  contracting_authority_name?: string;
  cpv_code?: string;
  jurisdiction?: TndJurisdiction;
  winners_only?: boolean;
  per_page?: number;
  page?: number;
}

export interface TndBenchmarkStatistics {
  count: number;
  average_discount: string | null;
  median_discount: string | null;
  max_discount: string | null;
  average_technical_score: string | null;
  average_economic_score: string | null;
  average_total_score: string | null;
}

export interface TndAlert {
  id: string;
  subject_type: string;
  subject_id: string;
  alert_type: TndAlertType;
  milestone: string;
  severity: TndAlertSeverity;
  message_key: string;
  message_params: Record<string, string | number> | null;
  due_at: string | null;
  raised_at: string;
  acknowledged_at: string | null;
}

export interface TndDeadline {
  participation_id: string;
  notice_id: string;
  title: string;
  jurisdiction: TndJurisdiction;
  deadline_at: string;
  kind: 'submission' | 'clarification';
}

export interface TndDashboard {
  pipeline_counts: Record<string, number>;
  upcoming_deadlines: TndDeadline[];
  vault: { valid: number; expiring_soon: number; expired: number };
  open_alerts: number;
  won_value: string | number;
  submitted_value: string | number;
}

export interface TndEdgue {
  format: 'edgue';
  version: string;
  xml: string;
  data: Record<string, unknown>;
}

export interface TndConvertPayload {
  contact_id?: string | null;
  project_manager_user_id?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  contract_title?: string | null;
}

export interface TndConversionResult {
  participation: TndParticipation;
  contract: { id: string; contract_number: string; title: string };
  project: {
    id: string;
    project_number: string;
    name: string;
    cig_code: string | null;
    cup_code: string | null;
  };
  references: {
    cig: string | null;
    cup: string | null;
    rup: string | null;
    dedicated_bank_account: string | null;
    simap_project_number: string | null;
    sdi_reference_block: string | null;
  };
}

/** Form values of a vault document (multipart on the wire). */
export interface TndVaultPayload {
  doc_type: TndVaultDocType;
  document_number?: string | null;
  issuing_body?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  intermediate_triennial_check_date?: string | null;
  soa_categories_classifications?: TndSoaRequirement[];
  numeric_value?: TndDecimal | null;
  notes?: string | null;
  file?: File | null;
}
