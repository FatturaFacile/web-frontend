/** Wire types of the green space maintenance vertical (Mod 126): sites, seasonal contracts, crews, route planner, phytosanitary diary and green waste slips. */

export const GC_BILLING_MODES = ['fixed_installments', 'per_passage', 'time_and_material'] as const;
export type GcBillingMode = (typeof GC_BILLING_MODES)[number];

export const GC_INSTALLMENT_FREQUENCIES = ['monthly', 'quarterly', 'seasonal_split'] as const;
export type GcInstallmentFrequency = (typeof GC_INSTALLMENT_FREQUENCIES)[number];

export const GC_CONTRACT_STATUSES = ['draft', 'active', 'suspended', 'expired', 'renewed'] as const;
export type GcContractStatus = (typeof GC_CONTRACT_STATUSES)[number];

export const GC_WEATHER_ALERTS = ['clear', 'rain_warning', 'frost_alert', 'rescheduled_due_to_weather'] as const;
export type GcWeatherAlert = (typeof GC_WEATHER_ALERTS)[number];

export const GC_ROUTE_STATUSES = ['planned', 'in_progress', 'completed', 'postponed'] as const;
export type GcRouteStatus = (typeof GC_ROUTE_STATUSES)[number];

export const GC_BILLING_STATUSES = ['not_billed', 'included_in_contract', 'ready_to_invoice', 'invoiced'] as const;
export type GcBillingStatus = (typeof GC_BILLING_STATUSES)[number];

export const GC_LICENSE_TYPES = ['PER', 'PNRP', 'OPF', 'PAN'] as const;
export type GcLicenseType = (typeof GC_LICENSE_TYPES)[number];

export const GC_DOSAGE_UNITS = ['ml/hl', 'g/100sqm', 'l/ha'] as const;
export type GcDosageUnit = (typeof GC_DOSAGE_UNITS)[number];

export const GC_EQUIPMENT_TYPES = [
  'lawnmowers',
  'ride_on_mowers',
  'chainsaws',
  'hedge_trimmers',
  'sprayers',
  'snow_plows',
] as const;
export type GcEquipmentType = (typeof GC_EQUIPMENT_TYPES)[number];

export const GC_SERVICES = [
  'mowing',
  'hedging',
  'fertilization',
  'irrigation_startup',
  'irrigation_winterization',
  'snow_clearing',
  'pruning',
  'phytosanitary',
] as const;
export type GcService = (typeof GC_SERVICES)[number];

export const GC_INVOICE_LINE_KINDS = [
  'installment',
  'snow_standby',
  'extra_passage',
  'time_and_material',
  'material',
  'waste',
] as const;
export type GcInvoiceLineKind = (typeof GC_INVOICE_LINE_KINDS)[number];

export type GcJurisdiction = 'IT' | 'CH';

export const GC_KPIS = [
  'active_contracts',
  'passages',
  'extra_passages_to_invoice',
  'weather_impacted_routes',
  'treatments_logged',
  'green_waste_kg',
] as const;

/** Error codes the API reports (`greenCare.error.<code>`). */
export const GC_ERROR_CODES = [
  'operator_license_missing',
  'operator_license_expired',
  'registration_number_invalid',
  'contract_not_active',
  'contract_not_billable',
  'contract_invalid_transition',
  'nothing_to_bill',
  'stop_already_completed',
  'route_locked',
  'week_start_invalid',
  'no_crews_available',
  'warehouse_required',
  'condominium_data_missing',
  'weather_unavailable',
  'file_not_found',
] as const;

export interface GcEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: GcPageMeta;
}

export interface GcPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** RFC 7807 problem of a refusal: the `code` picks the translation. */
export interface GcProblem {
  title?: string;
  detail?: string;
  code?: string;
  context?: Record<string, string | number | null>;
  errors?: Record<string, string[]>;
}

export interface GcExpiringLicense {
  license_id: string;
  operator_name: string;
  license_type: GcLicenseType;
  expiry_date: string;
  days_to_expiry: number;
}

export interface GcDashboard {
  active_contracts: number;
  passages_executed: number;
  passages_contracted: number;
  extra_passages_to_invoice: number;
  weather_impacted_routes: number;
  upcoming_routes: number;
  treatments_logged: number;
  green_waste_kg: number;
  expiring_licenses: GcExpiringLicense[];
}

export interface GcWasteCode {
  code: string;
  description: string;
}

export interface GcReference {
  jurisdictions: GcJurisdiction[];
  billing_modes: GcBillingMode[];
  installment_frequencies: GcInstallmentFrequency[];
  contract_statuses: GcContractStatus[];
  route_statuses: GcRouteStatus[];
  weather_alert_statuses: GcWeatherAlert[];
  billing_statuses: GcBillingStatus[];
  license_types: Record<GcJurisdiction, GcLicenseType[]>;
  dosage_units: GcDosageUnit[];
  equipment_types: GcEquipmentType[];
  services: GcService[];
  waste_codes: Record<GcJurisdiction, GcWasteCode[]>;
  registration_number_hint: Record<GcJurisdiction, string>;
  condominium_withholding_percent: number;
}

export interface GcIrrigationSpecs {
  zones: number | null;
  controller_type: string | null;
  winterized: boolean;
  notes: string | null;
}

export interface GcBotanicalEntry {
  species: string;
  planting_date: string | null;
  pruning_schedule: string | null;
  phytosanitary_notes: string | null;
}

export interface GcGeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GcSite {
  id: string;
  code: string;
  name: string;
  customer_id: string;
  customer_name: string | null;
  condominium_administrator_id: string | null;
  condominium_administrator_name: string | null;
  jurisdiction: GcJurisdiction;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_polygon_coordinates: GcGeoPolygon | null;
  lawn_area_sqm: number | null;
  hedge_length_meters: number | null;
  tree_count: number | null;
  irrigation_system_specs: GcIrrigationSpecs | null;
  access_gate_code: string | null;
  access_notes: string | null;
  botanical_inventory: GcBotanicalEntry[];
  is_active: boolean;
}

export interface GcSitePayload {
  code?: string | null;
  name: string;
  customer_id: string;
  condominium_administrator_id: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_polygon_coordinates: GcGeoPolygon | null;
  lawn_area_sqm: number | null;
  hedge_length_meters: number | null;
  tree_count: number | null;
  irrigation_system_specs: GcIrrigationSpecs | null;
  access_gate_code: string | null;
  access_notes: string | null;
  botanical_inventory: GcBotanicalEntry[];
  is_active: boolean;
}

export interface GcSiteFilters {
  search?: string | null;
  is_active?: boolean | null;
  customer_id?: string | null;
  page?: number;
  per_page?: number;
}

export interface GcPassageCounter {
  completed: number;
  included: number;
  extra: number;
  is_over_included: boolean;
  percent: number;
}

export interface GcContract {
  id: string;
  contract_number: string;
  site_id: string;
  site_name: string | null;
  customer_id: string;
  customer_name: string | null;
  condominium_administrator_id: string | null;
  condominium_administrator_name: string | null;
  season_start_date: string;
  season_end_date: string;
  billing_mode: GcBillingMode;
  included_passages_count: number;
  completed_passages_count: number;
  extra_passages_count: number;
  extra_passage_unit_price: number | null;
  fixed_fee_amount: number | null;
  installment_frequency: GcInstallmentFrequency | null;
  installments_billed: number;
  time_and_material_hourly_rate: number | null;
  snow_removal_standby_fee: number | null;
  snow_trigger_threshold_cm: number | null;
  included_services: GcService[];
  auto_bill_extra_passages: boolean;
  apply_condominium_withholding: boolean;
  is_condominium: boolean;
  condominium_fiscal_code: string | null;
  jurisdiction: GcJurisdiction;
  status: GcContractStatus;
  passage_counter: GcPassageCounter;
}

export interface GcContractPayload {
  contract_number?: string | null;
  site_id: string;
  customer_id: string;
  condominium_administrator_id: string | null;
  season_start_date: string;
  season_end_date: string;
  billing_mode: GcBillingMode;
  included_passages_count: number;
  extra_passage_unit_price: number | null;
  fixed_fee_amount: number | null;
  installment_frequency: GcInstallmentFrequency | null;
  time_and_material_hourly_rate: number | null;
  snow_removal_standby_fee: number | null;
  snow_trigger_threshold_cm: number | null;
  included_services: GcService[];
  auto_bill_extra_passages: boolean;
  apply_condominium_withholding: boolean;
  is_condominium: boolean;
  condominium_fiscal_code: string | null;
}

export interface GcContractFilters {
  status?: GcContractStatus | null;
  site_id?: string | null;
  customer_id?: string | null;
  search?: string | null;
  page?: number;
  per_page?: number;
}

export interface GcBillingRequest {
  period_start?: string | null;
  period_end?: string | null;
  include_installment?: boolean;
  include_snow_standby?: boolean;
  include_extra_passages?: boolean;
  include_time_and_material?: boolean;
  include_waste?: boolean;
}

export interface GcInvoiceLine {
  kind: GcInvoiceLineKind;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  net: number;
}

export interface GcWithholding {
  applies: boolean;
  percent: number;
  base: number;
  amount: number;
  type: string | null;
  reason: string | null;
}

export interface GcBillingResult {
  lines: GcInvoiceLine[];
  total_net: number;
  total_vat: number;
  withholding: GcWithholding | null;
  net_payable: number;
  jurisdiction: GcJurisdiction;
  condominium: { fiscal_code: string | null; administrator_name: string | null } | null;
  invoice_id: string | null;
  invoice_status: string | null;
}

export interface GcLicense {
  id: string;
  crew_team_member_id: string;
  operator_name: string;
  license_type: GcLicenseType;
  jurisdiction: GcJurisdiction;
  license_number: string;
  issuing_authority: string | null;
  issue_date: string | null;
  expiry_date: string;
  is_active: boolean;
  is_valid: boolean;
  days_to_expiry: number;
}

export interface GcLicensePayload {
  crew_team_member_id: string;
  license_type: GcLicenseType;
  license_number: string;
  issuing_authority: string | null;
  issue_date: string | null;
  expiry_date: string;
  is_active: boolean;
}

export interface GcCrewMember {
  id: string;
  name: string;
  user_id: string | null;
  role: string | null;
  hourly_rate: number | null;
  licenses: GcLicense[];
}

export type GcEquipment = Partial<Record<GcEquipmentType, number>>;

export interface GcCrew {
  id: string;
  name: string;
  code: string | null;
  default_vehicle_plate: string | null;
  default_trailer_plate: string | null;
  equipment: GcEquipment;
  daily_capacity_minutes: number;
  depot_latitude: number | null;
  depot_longitude: number | null;
  is_active: boolean;
  members: GcCrewMember[];
}

export interface GcGps {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

export interface GcCrewHours {
  members: { member_id: string; hours: number }[];
  total: number;
}

export interface GcMaterialUsed {
  product_id: string;
  name?: string | null;
  quantity: number;
  unit?: string | null;
  warehouse_id?: string | null;
}

export interface GcStop {
  id: string;
  route_schedule_id: string;
  site_id: string;
  site_name: string | null;
  site_address: string | null;
  latitude: number | null;
  longitude: number | null;
  contract_id: string | null;
  contract_number: string | null;
  stop_order: number;
  planned_activities: string[];
  estimated_duration_minutes: number;
  actual_checkin_at: string | null;
  actual_checkout_at: string | null;
  checkin_gps: GcGps | null;
  checkout_gps: GcGps | null;
  crew_hours_logged: GcCrewHours | null;
  machinery_hours_logged: { machine: string; hours: number }[] | null;
  materials_and_plants_used: GcMaterialUsed[] | null;
  before_photos: string[];
  after_photos: string[];
  counts_toward_contract_passage: boolean;
  is_extra_passage: boolean;
  billing_status: GcBillingStatus;
  invoice_id: string | null;
  passage_number: number | null;
  passage_included: number | null;
}

export interface GcWeatherForecast {
  precipitation_mm: number | null;
  temp_min: number | null;
  temp_max: number | null;
  wind_kmh: number | null;
  source: string | null;
  fetched_at: string | null;
}

export interface GcRoute {
  id: string;
  schedule_date: string;
  crew_team_id: string;
  crew_name: string | null;
  assigned_vehicle_plate: string | null;
  assigned_trailer_plate: string | null;
  equipment_list: GcEquipment | GcEquipmentType[] | null;
  weather_alert_status: GcWeatherAlert;
  weather_forecast_summary: GcWeatherForecast | null;
  route_optimization_metadata: { total_km: number; estimated_duration_minutes: number } | null;
  status: GcRouteStatus;
  stops: GcStop[];
}

export interface GcRouteFilters {
  from?: string | null;
  to?: string | null;
  crew_team_id?: string | null;
  status?: GcRouteStatus | null;
}

export interface GcOptimizeRequest {
  week_start: string;
  crew_team_ids?: string[];
  refresh_weather?: boolean;
}

export interface GcOptimizeResult {
  routes: GcRoute[];
  unassigned: { contract_id: string; site_id: string; site_name: string | null; reason: string }[];
  summary: { routes_created: number; stops_created: number };
}

export interface GcRescheduleResult {
  rescheduled_stops: number;
  affected_routes: GcRoute[];
  routes: GcRoute[];
}

export interface GcInterventionPayload {
  checkin_at: string | null;
  checkout_at: string | null;
  checkin_gps: GcGps | null;
  checkout_gps: GcGps | null;
  crew_hours: { member_id: string; hours: number }[];
  machinery_hours: { machine: string; hours: number }[];
  materials: { product_id: string; quantity: number; warehouse_id?: string | null }[];
  counts_toward_contract_passage: boolean;
  green_waste_weight_kg?: number | null;
  waste_code?: string | null;
  compost_facility_id?: string | null;
}

export interface GcTreatment {
  id: string;
  site_id: string;
  site_name: string | null;
  route_stop_id: string | null;
  treatment_date: string;
  target_pest_or_weed: string;
  treated_crop_or_surface: string;
  treated_area_sqm: number | null;
  commercial_product_name: string;
  registration_number: string;
  active_ingredient: string | null;
  dosage_used: number;
  dosage_unit: GcDosageUnit;
  water_volume_liters: number | null;
  warehouse_product_id: string | null;
  warehouse_id: string | null;
  quantity_deducted: number | null;
  operator_id: string;
  operator_name: string | null;
  operator_license_id: string | null;
  operator_license_type: GcLicenseType | null;
  re_entry_interval_hours: number | null;
  re_entry_until: string | null;
  weather_conditions_at_application: string | null;
  notes: string | null;
  jurisdiction: GcJurisdiction;
}

export interface GcTreatmentPayload {
  site_id: string;
  route_stop_id?: string | null;
  treatment_date: string;
  target_pest_or_weed: string;
  treated_crop_or_surface: string;
  treated_area_sqm: number | null;
  commercial_product_name: string;
  registration_number: string;
  active_ingredient: string | null;
  dosage_used: number;
  dosage_unit: GcDosageUnit;
  water_volume_liters: number | null;
  warehouse_product_id: string | null;
  warehouse_id: string | null;
  operator_id: string;
  re_entry_interval_hours: number | null;
  weather_conditions_at_application: string | null;
  notes: string | null;
}

export interface GcTreatmentFilters {
  from?: string | null;
  to?: string | null;
  site_id?: string | null;
  operator_id?: string | null;
  page?: number;
  per_page?: number;
}

export interface GcLicenseCheck {
  valid: boolean;
  license: GcLicense | null;
  reason: 'operator_license_missing' | 'operator_license_expired' | null;
  jurisdiction: GcJurisdiction;
}

export interface GcWasteSlip {
  id: string;
  slip_number: string;
  site_id: string | null;
  site_name: string | null;
  route_schedule_id: string | null;
  disposal_date: string;
  waste_code: string;
  waste_description: string | null;
  green_waste_weight_kg: number;
  compost_facility_id: string | null;
  compost_facility_name: string | null;
  transporter_vehicle_plate: string | null;
  document_reference: string | null;
  disposal_cost: number | null;
  is_billable_to_customer: boolean;
}

export interface GcWasteSlipPayload {
  slip_number?: string | null;
  site_id: string | null;
  route_schedule_id?: string | null;
  disposal_date: string;
  waste_code: string;
  waste_description: string | null;
  green_waste_weight_kg: number;
  compost_facility_id: string | null;
  transporter_vehicle_plate: string | null;
  document_reference: string | null;
  disposal_cost: number | null;
  is_billable_to_customer: boolean;
}

export interface GcWasteFilters {
  from?: string | null;
  to?: string | null;
  site_id?: string | null;
  waste_code?: string | null;
  page?: number;
  per_page?: number;
}

export interface GcWasteSummary {
  total_kg: number;
  billable_cost: number;
  by_waste_code: { waste_code: string; kg: number; slips: number }[];
  by_facility: { compost_facility_id: string | null; name: string | null; kg: number; slips: number }[];
}

export interface GcCrewPayload {
  name: string;
  code: string | null;
  default_vehicle_plate: string | null;
  default_trailer_plate: string | null;
  equipment: GcEquipment;
  daily_capacity_minutes: number;
  depot_latitude: number | null;
  depot_longitude: number | null;
  is_active: boolean;
  members: { id?: string; name: string; role: string | null; hourly_rate: number | null }[];
}
