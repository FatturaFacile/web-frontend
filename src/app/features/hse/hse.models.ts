/** Types of the HSE API (`/api/v1/hse`, Mod 099): matrix, clearance verdict, PPE hand-over and incident registry. */

export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED';
export type Jurisdiction = 'IT' | 'CH';

export type CertificateType =
  | 'general_safety_accordo_stato_regioni'
  | 'low_risk_specific'
  | 'medium_risk_specific'
  | 'high_risk_specific'
  | 'forklift_patentino_muletto'
  | 'crane_operator_gru'
  | 'first_aid_primo_soccorso'
  | 'fire_safety_antincendio'
  | 'work_at_height_lavori_in_quota'
  | 'confined_spaces'
  | 'suva_psa_training'
  | 'rspp_asl_training'
  | 'sibe_ekas_training';

export type FitnessOutcome =
  | 'fit_idoneo'
  | 'fit_with_prescriptions_idoneo_con_prescrizioni'
  | 'temporarily_unfit_inidoneo_temporaneo'
  | 'permanently_unfit_inidoneo_permanente';

export type IncidentType =
  | 'near_miss'
  | 'first_aid_injury'
  | 'lost_time_accident_inail_or_suva'
  | 'fatal_or_severe';

export type IncidentStatus = 'draft' | 'under_investigation' | 'corrective_actions_open' | 'closed';

export type BlockingReasonCode =
  | 'certificate_missing'
  | 'certificate_expired'
  | 'medical_missing'
  | 'medical_expired'
  | 'medical_unfit'
  | 'medical_restriction_conflict'
  | 'ppe_missing';

export type ClearanceContext = 'production_work_center' | 'external_field_service' | 'construction_site';

export interface TrainingCell {
  light: TrafficLight;
  expires_at: string | null;
  missing: boolean;
}

export interface MedicalCell {
  light: TrafficLight;
  fitness_outcome: FitnessOutcome | null;
  restrictions_summary: string | null;
  next_visit_due_date: string | null;
}

export interface PpeCell {
  light: TrafficLight;
  replacement_due_at: string | null;
  missing: boolean;
}

export interface MatrixRow {
  employee_id: string;
  employee_name: string;
  department_id: string | null;
  trainings: Record<string, TrainingCell>;
  medical: MedicalCell;
  ppe: Record<string, PpeCell>;
  overall: TrafficLight;
  is_hard_blocked: boolean;
}

export interface MatrixKpis {
  overall_compliance_percent: number;
  hard_blocked_workers: number;
  expiring_in_30_days: number;
  open_near_miss_and_capas: number;
}

export interface MatrixMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  kpis: MatrixKpis;
}

export interface MatrixFilters {
  page?: number;
  perPage?: number;
  departmentId?: string | null;
  workCenterId?: string | null;
  constructionSiteId?: string | null;
  status?: TrafficLight | null;
  jurisdiction?: Jurisdiction | null;
}

export interface BlockingReason {
  code: BlockingReasonCode;
  subject: string;
  expires_at: string | null;
  detail: string | null;
}

export interface ClearanceResult {
  is_cleared: boolean;
  blocking_reasons: BlockingReason[];
  warnings: string[];
}

export interface PpeDistribution {
  id: string;
  employee_id: string;
  product_id: string;
  warehouse_id: string;
  lot_or_serial_id: string | null;
  quantity: string;
  ce_marking_standard: string | null;
  handed_over_at: string;
  replacement_due_at: string | null;
  employee_signature_hash: string;
  verbale_consegna_pdf_id: string | null;
  delivery_status: string;
}

export interface PpeIssuePayload {
  employee_id: string;
  product_id: string;
  warehouse_id: string;
  lot_or_serial_id: string | null;
  quantity: number;
  ce_marking_standard: string | null;
  replacement_due_at: string | null;
  signature_payload: string;
  signature_image: string | null;
  locale: string;
}

export interface InjuryDynamics {
  activityAtTimeOfAccident: string;
  deviatingEvent: string;
  materialAgent: string;
  injuredBodyPartCode: string;
  lesionNatureCode: string;
}

export interface CorrectiveAction {
  description: string;
  assignee_id?: string | null;
  due_date?: string | null;
  verification_status?: 'open' | 'done' | 'verified';
}

export interface IncidentReport {
  id: string;
  protocol_number: string;
  jurisdiction: Jurisdiction;
  incident_date: string;
  incident_type: IncidentType;
  description: string;
  prognosis_days: number;
  status: IncidentStatus;
  root_cause_analysis: { whys?: string[]; root_cause?: string } | null;
  corrective_actions: CorrectiveAction[];
  linked_insurance_claim_id: string | null;
}

export interface IncidentPayload {
  incident_type: IncidentType;
  incident_date: string;
  description: string;
  prognosis_days: number;
  involved_employee_ids: string[];
  injury_dynamics: InjuryDynamics | null;
  root_cause_analysis: { whys: string[]; root_cause: string } | null;
  corrective_actions: CorrectiveAction[];
}

export interface Envelope<T, M = undefined> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}
