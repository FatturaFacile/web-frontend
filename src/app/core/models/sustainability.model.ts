/** ESG and carbon accounting (GHG Protocol, CSRD/ESRS). Mirrors the API FormRequests of the Sustainability module. */

export type EsgActivityType =
  | 'electricity_grid'
  | 'natural_gas'
  | 'fuel_diesel'
  | 'fuel_petrol'
  | 'business_travel_car'
  | 'business_travel_air'
  | 'business_travel_rail'
  | 'purchased_goods'
  | 'waste'
  | 'water';

export type EsgUnit = 'kWh' | 'm3' | 'l' | 'km' | 'EUR' | 'CHF' | 'kg';
export type EsgRegion = 'IT' | 'CH' | 'EU' | 'GLOBAL';
export type EsgScope = 1 | 2 | 3;
export type EsgDataQuality = 'measured' | 'estimated';
export type EsgPeriodStatus = 'open' | 'closed';
export type EsgTargetScope = 'scope_1' | 'scope_2' | 'scope_3' | 'total';
export type EsgTargetStatus = 'draft' | 'active' | 'achieved' | 'missed' | 'cancelled';
export type EsgPillar = 'environmental' | 'social' | 'governance';
export type EsgKpiDirection = 'higher_is_better' | 'lower_is_better';
export type EsgMaterialityStatus = 'draft' | 'approved';
export type EsgMaterialityType = 'both' | 'impact' | 'financial' | 'none';

export const ESG_ACTIVITY_TYPES: readonly EsgActivityType[] = [
  'electricity_grid',
  'natural_gas',
  'fuel_diesel',
  'fuel_petrol',
  'business_travel_car',
  'business_travel_air',
  'business_travel_rail',
  'purchased_goods',
  'waste',
  'water',
];

/** Units each activity type is measured in (same as the API catalogue). */
export const ESG_ACTIVITY_UNITS: Readonly<Record<EsgActivityType, readonly EsgUnit[]>> = {
  electricity_grid: ['kWh'],
  natural_gas: ['m3'],
  fuel_diesel: ['l'],
  fuel_petrol: ['l'],
  business_travel_car: ['km'],
  business_travel_air: ['km'],
  business_travel_rail: ['km'],
  purchased_goods: ['EUR', 'CHF'],
  waste: ['kg'],
  water: ['m3'],
};

export const ESG_REGIONS: readonly EsgRegion[] = ['IT', 'CH', 'EU', 'GLOBAL'];
export const ESG_TARGET_SCOPES: readonly EsgTargetScope[] = ['scope_1', 'scope_2', 'scope_3', 'total'];
export const ESG_PILLARS: readonly EsgPillar[] = ['environmental', 'social', 'governance'];
export const ESG_ESRS_CODES: readonly string[] = ['E1', 'E2', 'E3', 'E4', 'E5', 'S1', 'S2', 'S3', 'S4', 'G1'];

export interface EsgEmissionFactor {
  id: string;
  code: string;
  version: number;
  name: string;
  activity_type: EsgActivityType;
  unit: EsgUnit;
  scope: EsgScope;
  category: string;
  kg_co2e_per_unit: string;
  region: EsgRegion;
  source: string;
  source_year: number;
  is_example: boolean;
  is_active: boolean;
  notes?: string | null;
}

export interface EsgEmissionFactorRequest {
  code?: string;
  name: string;
  activity_type: EsgActivityType;
  unit: EsgUnit;
  kg_co2e_per_unit: string;
  region?: EsgRegion | null;
  source: string;
  source_year: number;
  notes?: string | null;
  is_active?: boolean | null;
}

export interface EsgFactorVersionRequest {
  kg_co2e_per_unit: string;
  source: string;
  source_year: number;
}

export interface EsgReportingPeriod {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: EsgPeriodStatus;
  revenue?: string | null;
  currency: 'EUR' | 'CHF';
  employees_fte?: string | null;
  closed_at?: string | null;
}

export interface EsgReportingPeriodRequest {
  name: string;
  starts_on: string;
  ends_on: string;
  revenue?: string | null;
  currency?: 'EUR' | 'CHF' | null;
  employees_fte?: string | null;
}

export interface EsgActivityRecord {
  id: string;
  emission_factor_id: string;
  activity_date: string;
  quantity: string;
  unit: EsgUnit;
  activity_type: EsgActivityType;
  scope: EsgScope;
  category: string;
  factor_code: string;
  factor_version: number;
  factor_kg_co2e_per_unit: string;
  factor_source: string;
  co2e_kg: string;
  data_quality: EsgDataQuality;
  site?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface EsgActivityRecordRequest {
  emission_factor_id?: string | null;
  activity_type?: EsgActivityType | null;
  region?: EsgRegion | null;
  activity_date: string;
  quantity: string;
  unit: EsgUnit;
  data_quality?: EsgDataQuality | null;
  site?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface EsgActivityFilters {
  from?: string;
  to?: string;
  scope?: EsgScope;
  activity_type?: EsgActivityType;
  data_quality?: EsgDataQuality;
  page?: number;
  per_page?: number;
}

export interface EsgInventoryCategory {
  category: string;
  co2e_kg: string;
  share_percent: string;
  records: number;
}

export interface EsgInventoryScope {
  scope: EsgScope;
  co2e_kg: string;
  tco2e: string;
  share_percent: string;
  categories: EsgInventoryCategory[];
}

export interface EsgInventoryDelta {
  absolute_kg: string;
  percent: string | null;
}

export interface EsgInventory {
  period: { id: string; name: string; starts_on: string; ends_on: string; status: EsgPeriodStatus };
  totals: { scope_1_kg: string; scope_2_kg: string; scope_3_kg: string; total_kg: string; total_tco2e: string };
  scopes: EsgInventoryScope[];
  data_quality: { records: number; estimated_records: number; estimated_kg: string; estimated_share_percent: string };
  intensity: { currency: string; tco2e_per_million_revenue: string | null; tco2e_per_fte: string | null };
  previous: {
    period_id: string;
    period_name: string;
    totals: { total_kg: string; total_tco2e: string };
    delta: { scope_1: EsgInventoryDelta; scope_2: EsgInventoryDelta; scope_3: EsgInventoryDelta; total: EsgInventoryDelta };
  } | null;
}

export interface EsgTargetProgress {
  baseline_co2e_kg: string;
  target_co2e_kg: string;
  current_year: number | null;
  current_co2e_kg: string | null;
  reduction_achieved_percent: string | null;
  expected_reduction_percent: string | null;
  progress_percent: string | null;
  on_track: boolean | null;
}

export interface EsgReductionTarget {
  id: string;
  name: string;
  scope: EsgTargetScope;
  baseline_year: number;
  baseline_co2e_kg?: string | null;
  target_year: number;
  reduction_percent: string;
  status: EsgTargetStatus;
  notes?: string | null;
  progress: EsgTargetProgress | null;
}

export interface EsgReductionTargetRequest {
  name: string;
  scope: EsgTargetScope;
  baseline_year: number;
  target_year: number;
  reduction_percent: string;
  notes?: string | null;
}

export interface EsgKpiDefinition {
  id: string;
  code: string;
  name: string;
  pillar: EsgPillar;
  unit: string;
  direction: EsgKpiDirection;
  esrs_reference?: string | null;
  target_value?: string | null;
  is_example: boolean;
  is_active: boolean;
  description?: string | null;
}

export interface EsgKpiDefinitionRequest {
  code?: string;
  name: string;
  pillar: EsgPillar;
  unit: string;
  direction?: EsgKpiDirection | null;
  esrs_reference?: string | null;
  target_value?: string | null;
  description?: string | null;
  is_active?: boolean | null;
}

export interface EsgKpiValue {
  id: string;
  kpi_definition_id: string;
  reporting_period_id: string;
  value: string;
  data_quality: EsgDataQuality;
  notes?: string | null;
  kpi?: EsgKpiDefinition;
  target_met: boolean | null;
}

export interface EsgKpiValueRequest {
  kpi_definition_id: string;
  reporting_period_id: string;
  value: string;
  data_quality?: EsgDataQuality | null;
  notes?: string | null;
}

export interface EsgMaterialityTopic {
  id: string;
  esrs_code: string;
  name: string;
  impact_score: string;
  financial_score: string;
  is_material: boolean;
  materiality_type: EsgMaterialityType;
  rationale?: string | null;
}

export interface EsgMaterialityAssessment {
  id: string;
  name: string;
  reporting_period_id?: string | null;
  threshold: string;
  status: EsgMaterialityStatus;
  notes?: string | null;
  topics: EsgMaterialityTopic[];
  material_topics_count: number;
}

export interface EsgMaterialityTopicRequest {
  esrs_code: string;
  name: string;
  impact_score: string;
  financial_score: string;
  rationale?: string | null;
}

export interface EsgMaterialityAssessmentRequest {
  name: string;
  reporting_period_id?: string | null;
  threshold?: string | null;
  notes?: string | null;
  topics?: EsgMaterialityTopicRequest[];
}

export const ESG_ESRS_STANDARDS = ['ESRS2', 'E1', 'E2', 'E3', 'E4', 'E5', 'S1', 'S2', 'S3', 'S4', 'G1'] as const;

export type EsgEsrsStandard = (typeof ESG_ESRS_STANDARDS)[number];
export type EsgEsrsDataType = 'number' | 'text' | 'boolean';
export type EsgEsrsValueStatus = 'draft' | 'reviewed' | 'approved' | 'not_applicable';

export interface EsgEsrsValue {
  id: string;
  datapoint_id: string;
  status: EsgEsrsValueStatus;
  value_number: string | null;
  value_text: string | null;
  value_boolean: boolean | null;
  source: 'manual' | 'inventory';
  omission_reason: string | null;
  notes: string | null;
}

export interface EsgEsrsDatapoint {
  id: string;
  code: string;
  standard: EsgEsrsStandard;
  disclosure: string;
  name: string;
  description: string | null;
  data_type: EsgEsrsDataType;
  unit: string | null;
  is_mandatory: boolean;
  auto_source: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface EsgEsrsPackageRow extends EsgEsrsDatapoint {
  is_required: boolean;
  value: EsgEsrsValue | null;
}

export interface EsgEsrsPackage {
  period_id: string;
  materiality: {
    assessment_id: string | null;
    material_standards: string[];
    assessed_standards: string[];
    unassessed_standards: string[];
  };
  datapoints: EsgEsrsPackageRow[];
}

export interface EsgEsrsValueLine {
  datapoint_id: string;
  status?: EsgEsrsValueStatus | null;
  value_number?: string | number | null;
  value_text?: string | null;
  value_boolean?: boolean | null;
  omission_reason?: string | null;
  notes?: string | null;
}

export interface EsgEsrsCompleteness {
  period_id: string;
  is_complete: boolean;
  percent: string;
  required: number;
  complete: number;
  materiality_assessment_id: string | null;
  standards: { standard: string; is_material: boolean; required: number; complete: number; percent: string }[];
  missing: {
    datapoint_id: string;
    code: string;
    standard: string;
    name: string;
    reason: 'no_value' | 'not_approved' | 'omission_reason_missing';
  }[];
  issues: string[];
  warnings: string[];
  scope3_categories_without_data: number[];
  open_supplier_requests: number;
}

export interface EsgScope3Category {
  category: number;
  key: string;
  co2e_kg: string;
  share_percent: string;
  records: number;
  supplier_specific_kg: string;
  supplier_specific_percent: string;
  estimated_percent: string;
  open_supplier_requests: number;
  has_data: boolean;
}

export interface EsgScope3Report {
  period_id: string;
  total_kg: string;
  total_tco2e: string;
  supplier_specific_percent: string;
  categories_with_data: number;
  unmapped_kg: string;
  categories: EsgScope3Category[];
}

export type EsgSupplierRequestStatus = 'requested' | 'received' | 'applied' | 'declined' | 'cancelled';

export interface EsgSupplierRequest {
  id: string;
  reporting_period_id: string;
  supplier_id: string;
  supplier_name: string | null;
  document_requirement_id: string | null;
  submission_id: string | null;
  scope3_category: number;
  activity_type: string;
  unit: string;
  quantity: string;
  status: EsgSupplierRequestStatus;
  due_date: string | null;
  reported_co2e_kg: string | null;
  calculation_method: string | null;
  emission_factor_id: string | null;
  activity_record_id: string | null;
  notes: string | null;
  received_at: string | null;
  applied_at: string | null;
  created_at: string;
}

export interface EsgSupplierRequestPayload {
  reporting_period_id: string;
  supplier_id: string;
  scope3_category: number;
  activity_type: string;
  unit: string;
  quantity: string;
  due_date?: string | null;
  notes?: string | null;
}

export interface EsgSupplierReceivePayload {
  reported_co2e_kg: string;
  calculation_method?: string | null;
  submission_id?: string | null;
}

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface EsgResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
