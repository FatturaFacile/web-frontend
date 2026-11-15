/** Quality management extension: SPC, instrument calibration and customer complaints. Mirrors the API FormRequests of the Quality module. */

export interface QualityResponse<T> {
  data: T;
  meta?: { total?: number; current_page?: number; last_page?: number };
}

export type SpcCharacteristicStatus = 'active' | 'archived';

export interface SpcCharacteristic {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  lower_spec_limit: string | null;
  upper_spec_limit: string | null;
  target: string | null;
  subgroup_size: number;
  instrument_id: string | null;
  status: SpcCharacteristicStatus;
  notes: string | null;
}

export interface SpcCharacteristicRequest {
  code: string;
  name: string;
  unit: string | null;
  lower_spec_limit: string | null;
  upper_spec_limit: string | null;
  target: string | null;
  subgroup_size: number;
  instrument_id: string | null;
  notes: string | null;
}

export interface SpcSampleRequest {
  measurements: number[];
  sampled_at: string | null;
  lot: string | null;
  instrument_id: string | null;
}

export interface SpcViolation {
  sample_id: string;
  index: number;
  chart: 'xbar' | 'range';
  rule: number;
}

export interface SpcSampleResponse {
  data: { id: string };
  violations: SpcViolation[];
}

export interface SpcControlLimits {
  center: number;
  ucl: number;
  lcl: number;
}

export interface SpcCapability {
  mean: number;
  sigma_within: number;
  sigma_overall: number;
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  measurement_count: number;
}

export interface SpcChartPoint {
  sample_id: string;
  sampled_at: string;
  lot: string | null;
  mean: number;
  range: number;
}

export interface SpcChart {
  characteristic_id: string;
  subgroup_size: number;
  subgroup_count: number;
  is_reliable: boolean;
  in_control: boolean;
  points: SpcChartPoint[];
  limits: { xbar: SpcControlLimits; range: SpcControlLimits } | null;
  capability: SpcCapability | null;
  violations: SpcViolation[];
}

export type InstrumentStatus = 'active' | 'quarantined' | 'retired';
export type InstrumentCalibrationStatus = 'valid' | 'due_soon' | 'overdue' | 'quarantined' | 'retired';
export type CalibrationResult = 'pass' | 'adjusted' | 'out_of_tolerance';

export const CALIBRATION_RESULTS: readonly CalibrationResult[] = ['pass', 'adjusted', 'out_of_tolerance'];

export interface QualityInstrument {
  id: string;
  code: string;
  name: string;
  serial_number: string | null;
  manufacturer: string | null;
  location: string | null;
  unit: string | null;
  range_min: string | null;
  range_max: string | null;
  tolerance: string | null;
  calibration_interval_days: number;
  status: InstrumentStatus;
  last_calibrated_on: string | null;
  next_due_on: string | null;
  calibration_status: InstrumentCalibrationStatus;
  notes: string | null;
}

export interface QualityInstrumentRequest {
  code: string;
  name: string;
  serial_number: string | null;
  manufacturer: string | null;
  location: string | null;
  unit: string | null;
  range_min: string | null;
  range_max: string | null;
  tolerance: string | null;
  calibration_interval_days: number;
  notes: string | null;
}

export interface QualityCalibration {
  id: string;
  instrument_id: string;
  calibrated_on: string;
  next_due_on: string;
  result: CalibrationResult;
  as_found_error: string | null;
  as_left_error: string | null;
  laboratory: string | null;
  certificate_number: string | null;
  certificate_document_id: string | null;
  nonconformity_id: string | null;
  notes: string | null;
}

export interface QualityCalibrationRequest {
  calibrated_on: string;
  next_due_on: string | null;
  result: CalibrationResult;
  as_found_error: string | null;
  as_left_error: string | null;
  laboratory: string | null;
  certificate_number: string | null;
  notes: string | null;
}

export interface QualityCalibrationImpact {
  from: string | null;
  to: string;
  sample_count: number;
  characteristics: { characteristic_id: string; code: string | null; name: string | null; sample_count: number; lots: string[] }[];
}

export type ComplaintStatus = 'received' | 'investigating' | 'replied' | 'closed' | 'rejected';
export type ComplaintSeverity = 'minor' | 'major' | 'critical';
export type ComplaintChannel = 'email' | 'phone' | 'letter' | 'web' | 'in_person' | 'other';

export const COMPLAINT_SEVERITIES: readonly ComplaintSeverity[] = ['minor', 'major', 'critical'];
export const COMPLAINT_CHANNELS: readonly ComplaintChannel[] = ['email', 'phone', 'letter', 'web', 'in_person', 'other'];

export interface QualityComplaint {
  id: string;
  number: string;
  customer_name: string;
  contact_id: string | null;
  received_at: string;
  channel: ComplaintChannel;
  reference: string | null;
  product_description: string | null;
  description: string;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  owner_id: string | null;
  root_cause: string | null;
  nonconformity_id: string | null;
  capa_action_id: string | null;
  reply_text: string | null;
  replied_at: string | null;
  closed_at: string | null;
  closure_notes: string | null;
}

export interface QualityComplaintRequest {
  customer_name: string;
  received_at: string | null;
  channel: ComplaintChannel;
  reference: string | null;
  product_description: string | null;
  description: string;
  severity: ComplaintSeverity;
}

export type ComplaintAction = 'investigate' | 'root-cause' | 'raise-nonconformity' | 'reply' | 'reject' | 'close';

export interface QualityComplaintFilters {
  status?: ComplaintStatus | '';
  severity?: ComplaintSeverity | '';
  open?: boolean;
}

export interface QualityInstrumentFilters {
  status?: InstrumentStatus | '';
  calibration?: 'overdue' | 'due_soon' | '';
}
