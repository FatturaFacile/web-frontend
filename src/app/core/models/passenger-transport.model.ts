/**
 * Wire types of the passenger transport vertical (Mod 176), served under `/api/v1/passenger-transport`: NCC, taxi, GT coach and
 * school bus bookings with flight tracking, the cross-border (CH-IT) kilometre split and VAT split, dispatch with OLR 1 / OLR 2 /
 * Reg. (EC) 561/2006 checks, the NCC electronic service sheet, the tachograph (.DDD) archive, concierge and school bus contracts.
 * Amounts and kilometres travel as decimal strings; dates as `YYYY-MM-DD`, instants as ISO 8601.
 * Every label of these codes is in the dictionary the API serves (`passengerTransport.<group>.<code>`).
 */

export type PtrDecimal = string | number;

export const PTR_SERVICE_TYPES = [
  'airport_transfer',
  'hourly_disposal',
  'multi_day_tour_coach',
  'school_bus_route',
  'medical_non_emergency',
] as const;
export type PtrServiceType = (typeof PTR_SERVICE_TYPES)[number];

export const PTR_BOOKING_STATUSES = [
  'draft',
  'confirmed',
  'assigned',
  'en_route_to_pickup',
  'at_pickup_waiting',
  'passenger_on_board',
  'completed',
  'cancelled',
  'invoiced',
] as const;
export type PtrBookingStatus = (typeof PTR_BOOKING_STATUSES)[number];

export const PTR_FLIGHT_STATUSES = [
  'scheduled',
  'en_route',
  'delayed',
  'landed',
  'cancelled',
] as const;
export type PtrFlightStatus = (typeof PTR_FLIGHT_STATUSES)[number];

export const PTR_VEHICLE_CATEGORIES = [
  'sedan_ncc',
  'luxury_van_ncc',
  'minibus_9_16',
  'gt_coach_over_3_5t',
  'school_bus',
  'taxi',
] as const;
export type PtrVehicleCategory = (typeof PTR_VEHICLE_CATEGORIES)[number];

export const PTR_BORDER_CROSSINGS = [
  'chiasso_brogeda',
  'gaggiolo',
  'ponte_tresa',
  'porto_ceresio',
  'sempione',
  'gran_san_bernardo',
  'castasegna',
  'tirano',
  'none',
] as const;
export type PtrBorderCrossing = (typeof PTR_BORDER_CROSSINGS)[number];

export const PTR_DRIVING_REGIMES = ['olr1_ec561', 'olr2'] as const;
export type PtrDrivingRegime = (typeof PTR_DRIVING_REGIMES)[number];

export const PTR_ISSUE_SEVERITIES = ['blocking', 'warning'] as const;
export type PtrIssueSeverity = (typeof PTR_ISSUE_SEVERITIES)[number];

export const PTR_SHEET_STATUSES = ['open', 'closed', 'transmitted'] as const;
export type PtrSheetStatus = (typeof PTR_SHEET_STATUSES)[number];

export const PTR_EXCHANGE_DIRECTIONS = ['none', 'ceded', 'acquired'] as const;
export type PtrExchangeDirection = (typeof PTR_EXCHANGE_DIRECTIONS)[number];

export const PTR_VAT_LINE_KINDS = [
  'it_domestic',
  'it_exempt_art10_n14',
  'it_foreign_leg',
  'ch_domestic',
  'ch_foreign_leg',
  'ch_exempt_art23',
] as const;
export type PtrVatLineKind = (typeof PTR_VAT_LINE_KINDS)[number];

export type PtrJurisdiction = 'IT' | 'CH';

export type PtrBookingAction = 'confirm' | 'start_run' | 'arrive' | 'board' | 'complete' | 'cancel';

export type PtrExchangeAction = 'cede' | 'acquire' | 'release';

// --- Envelopes and problems ---

export interface PtrEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PtrPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PtrPage<T> extends PtrEnvelope<T[]> {
  meta: PtrPageMeta;
}

/** RFC 7807 problem of a refused rule: `code` picks the translated text, 422 brings the field errors. */
export interface PtrProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  params?: Record<string, unknown>;
}

// --- Reference data ---

export interface PtrBorderCrossingRef {
  value: PtrBorderCrossing;
  lat: number | null;
  lng: number | null;
}

export interface PtrAirport {
  iata: string;
  country: string;
  lat: number;
  lng: number;
}

export interface PtrLookups {
  service_types: PtrServiceType[];
  booking_statuses: PtrBookingStatus[];
  flight_statuses: PtrFlightStatus[];
  vehicle_categories: PtrVehicleCategory[];
  driving_regimes: PtrDrivingRegime[];
  sheet_statuses: PtrSheetStatus[];
  exchange_directions: PtrExchangeDirection[];
  vat_line_kinds: PtrVatLineKind[];
  currencies: string[];
  border_crossings: PtrBorderCrossingRef[];
  airports: PtrAirport[];
  jurisdiction: PtrJurisdiction;
  vat: { it_rate: string; ch_rate: string; it_foreign_nature: string };
}

export interface PtrPersonRef {
  id: string;
  name: string;
  type?: string | null;
}

// --- Bookings ---

export interface PtrChildSeats {
  infant?: number;
  child?: number;
  booster?: number;
}

export interface PtrWaypoint {
  address: string;
  lat?: number | null;
  lng?: number | null;
}

export interface PtrBooking {
  id: string;
  booking_code: string;
  service_type: PtrServiceType;
  status: PtrBookingStatus;
  ordering_customer_id: string | null;
  ordering_customer_name?: string | null;
  b2b_concierge_user_id: string | null;
  hotel_contract_id: string | null;
  school_contract_id: string | null;
  lead_passenger_name: string | null;
  lead_passenger_phone: string | null;
  vip_welcome_sign_text: string | null;
  has_welcome_logo: boolean;
  passengers_count: number;
  luggage_count: number;
  child_seats_spec: PtrChildSeats | null;
  accessibility_notes: string | null;
  flight_or_train_number: string | null;
  flight_carrier_iata: string | null;
  arrival_airport_iata: string | null;
  scheduled_flight_arrival_at: string | null;
  estimated_flight_arrival_at: string | null;
  flight_status: PtrFlightStatus | null;
  flight_delay_minutes: number;
  flight_checked_at: string | null;
  pickup_datetime: string;
  estimated_dropoff_datetime: string | null;
  pickup_address: string;
  pickup_lat: PtrDecimal | null;
  pickup_lng: PtrDecimal | null;
  pickup_country_code: string;
  dropoff_address: string;
  dropoff_lat: PtrDecimal | null;
  dropoff_lng: PtrDecimal | null;
  dropoff_country_code: string;
  waypoints: PtrWaypoint[] | null;
  total_distance_km: PtrDecimal;
  it_territory_km: PtrDecimal;
  ch_territory_km: PtrDecimal;
  other_eu_territory_km: PtrDecimal;
  border_crossing_point: PtrBorderCrossing;
  cross_border: boolean;
  agreed_price_net: PtrDecimal;
  currency: string;
  vat_exemption_art23: boolean;
  municipal_urban_service: boolean;
  hotel_concierge_commission_rate: PtrDecimal | null;
  hotel_concierge_commission_amount: PtrDecimal;
  exchange_direction: PtrExchangeDirection;
  subcontracted_carrier_id: string | null;
  subcontracted_carrier_name?: string | null;
  subcontractor_payout_amount: PtrDecimal;
  assignor_commission_amount: PtrDecimal;
  assigned_vehicle_id: string | null;
  assigned_vehicle_plate?: string | null;
  assigned_driver_id: string | null;
  assigned_driver_name?: string | null;
  invoice_id: string | null;
  editable: boolean;
  created_at: string | null;
}

/** What the booking form sends: the route, the passengers, the flight and the fare. */
export interface PtrBookingPayload {
  service_type: PtrServiceType;
  ordering_customer_id?: string | null;
  lead_passenger_name?: string | null;
  lead_passenger_phone?: string | null;
  vip_welcome_sign_text?: string | null;
  passengers_count?: number;
  luggage_count?: number;
  child_seats_spec?: PtrChildSeats | null;
  accessibility_notes?: string | null;
  flight_or_train_number?: string | null;
  flight_carrier_iata?: string | null;
  arrival_airport_iata?: string | null;
  scheduled_flight_arrival_at?: string | null;
  pickup_datetime: string;
  pickup_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  pickup_country_code?: string;
  dropoff_address: string;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  dropoff_country_code?: string;
  border_crossing_point?: PtrBorderCrossing;
  total_distance_km?: PtrDecimal;
  it_territory_km?: PtrDecimal;
  ch_territory_km?: PtrDecimal;
  agreed_price_net: PtrDecimal;
  currency?: string;
  vat_exemption_art23?: boolean;
  municipal_urban_service?: boolean;
  hotel_concierge_commission_rate?: PtrDecimal | null;
}

export interface PtrBookingFilters {
  q?: string;
  status?: PtrBookingStatus | '';
  service_type?: PtrServiceType | '';
  from?: string;
  to?: string;
  customer_id?: string;
  page?: number;
  per_page?: number;
}

// --- Cross-border quote and VAT split ---

export interface PtrVatLine {
  kind: PtrVatLineKind;
  km: string;
  net: string;
  rate: string;
  tax: string;
  nature: string | null;
  legal_reference: string;
}

export interface PtrVatBreakdown {
  currency: string;
  lines: PtrVatLine[];
  domestic_share: string;
  foreign_share: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
}

export interface PtrQuote {
  route: {
    total_distance_km: PtrDecimal;
    it_territory_km: PtrDecimal;
    ch_territory_km: PtrDecimal;
    other_eu_territory_km: PtrDecimal;
    border_crossing_point: PtrBorderCrossing;
    estimated_dropoff_datetime: string | null;
  };
  vat: PtrVatBreakdown;
  hotel_concierge_commission_amount: PtrDecimal;
}

// --- Compliance and assignment ---

export interface PtrComplianceIssue {
  code: string;
  severity: PtrIssueSeverity;
  citation: string;
  params: Record<string, string | number | null>;
  message: string;
}

export interface PtrComplianceResult {
  regime: PtrDrivingRegime;
  issues: PtrComplianceIssue[];
  blocking_count: number;
  warning_count: number;
  can_assign: boolean;
  remaining_minutes: number;
  next_mandatory_break_or_rest_at: string | null;
}

export interface PtrAssignPayload {
  vehicle_id: string;
  driver_employee_id: string;
  planned_break_minutes?: number;
  acknowledge_warnings?: boolean;
  dry_run?: boolean;
}

export interface PtrAssignResult {
  compliance: PtrComplianceResult;
  booking: PtrBooking;
}

export interface PtrFlightResult {
  status: PtrFlightStatus | null;
  delay_minutes: number;
  adjusted: boolean;
  previous_pickup: string | null;
  new_pickup: string | null;
  conflicts: PtrComplianceIssue[];
}

// --- Fleet and drivers ---

export interface PtrVehicle {
  id: string;
  license_plate: string;
  vehicle_category: PtrVehicleCategory;
  gross_weight_tons: PtrDecimal;
  passenger_capacity: number;
  has_digital_tachograph: boolean;
  psva_subject: boolean;
  ncc_authorization_number: string | null;
  ncc_issuing_municipality: string | null;
  odometer_km: number;
  active: boolean;
}

export interface PtrVehiclePayload {
  license_plate: string;
  vehicle_category: PtrVehicleCategory;
  gross_weight_tons?: PtrDecimal;
  passenger_capacity: number;
  has_digital_tachograph?: boolean;
  psva_subject?: boolean;
  ncc_authorization_number?: string | null;
  ncc_issuing_municipality?: string | null;
  odometer_km?: number;
  active?: boolean;
}

export interface PtrDriver {
  id: string;
  driver_employee_id: string;
  driver_name?: string | null;
  driving_license_number: string | null;
  driving_license_categories: string[];
  driving_license_expiry_date: string | null;
  cqc_persone_number_it: string | null;
  cqc_persone_expiry_date: string | null;
  czv_certificate_number_ch: string | null;
  czv_expiry_date: string | null;
  tachograph_card_number: string | null;
  tachograph_card_expiry_date: string | null;
  daily_driving_minutes_used: number;
  extended_10h_days_used_this_week: number;
  continuous_driving_minutes_since_break: number;
  weekly_driving_minutes_used: number;
  biweekly_driving_minutes_used: number;
  last_daily_rest_duration_minutes: number;
  reduced_9h_rests_used_between_weekly_rests: number;
  last_weekly_rest_ended_at: string | null;
  available_for_next_trip: boolean;
  next_mandatory_break_or_rest_at: string | null;
  counters_updated_at: string | null;
}

export interface PtrDriverPayload {
  driver_employee_id?: string;
  driving_license_number?: string | null;
  driving_license_categories?: string[];
  driving_license_expiry_date?: string | null;
  cqc_persone_number_it?: string | null;
  cqc_persone_expiry_date?: string | null;
  czv_certificate_number_ch?: string | null;
  czv_expiry_date?: string | null;
  tachograph_card_number?: string | null;
  tachograph_card_expiry_date?: string | null;
}

export interface PtrInfringementSummary {
  code: string;
  date: string;
  minutes: number;
}

export interface PtrDddArchive {
  id: string;
  driver_employee_id: string | null;
  driver_name?: string | null;
  vehicle_id: string | null;
  file_type: 'driver_card' | 'vehicle_unit';
  original_name: string;
  file_size: number;
  sha256: string;
  card_number: string | null;
  period_start: string | null;
  period_end: string | null;
  infringements_count: number;
  infringements_summary: PtrInfringementSummary[];
  uploaded_at: string | null;
}

export interface PtrInfringement {
  id: string;
  driver_employee_id: string;
  ddd_archive_id: string | null;
  event_date: string;
  code: string;
  minutes: number;
}

// --- Dispatch timeline ---

export interface PtrTimelineBooking {
  id: string;
  booking_code: string;
  service_type: PtrServiceType;
  status: PtrBookingStatus;
  pickup_datetime: string;
  estimated_dropoff_datetime: string | null;
  pickup_address: string;
  dropoff_address: string;
  lead_passenger_name: string | null;
  passengers_count: number;
  flight_or_train_number: string | null;
  flight_status: PtrFlightStatus | null;
  flight_delay_minutes: number;
  cross_border: boolean;
  border_crossing_point: PtrBorderCrossing;
  exchange_direction: PtrExchangeDirection;
  carrier_name: string | null;
}

export interface PtrDriverGauges {
  daily_used_minutes: number;
  daily_limit_minutes: number;
  weekly_used_minutes: number;
  weekly_limit_minutes: number | null;
  biweekly_used_minutes: number;
  biweekly_limit_minutes: number | null;
  remaining_minutes: number;
}

export interface PtrTimelineVehicle {
  id: string;
  license_plate: string;
  vehicle_category: PtrVehicleCategory;
  passenger_capacity: number;
  bookings: PtrTimelineBooking[];
}

export interface PtrTimelineDriver {
  id: string;
  name: string | null;
  regime: PtrDrivingRegime;
  available_for_next_trip: boolean;
  next_mandatory_break_or_rest_at: string | null;
  gauges: PtrDriverGauges;
  documents: {
    license_expiry: string | null;
    cqc_expiry: string | null;
    czv_expiry: string | null;
    tachograph_card_expiry: string | null;
  };
  bookings: PtrTimelineBooking[];
}

export interface PtrTimeline {
  from: string;
  to: string;
  vehicles: PtrTimelineVehicle[];
  drivers: PtrTimelineDriver[];
  unassigned: PtrTimelineBooking[];
  subcontracted: PtrTimelineBooking[];
}

// --- Service sheets ---

export interface PtrManifestPassenger {
  name: string;
  birth_date?: string | null;
  document?: string | null;
  nationality?: string | null;
}

export interface PtrServiceSheet {
  id: string;
  number: string;
  sheet_year: number;
  progressive_sheet_number: number;
  booking_id: string;
  vehicle_id: string | null;
  driver_employee_id: string | null;
  status: PtrSheetStatus;
  garage_departure_at: string | null;
  garage_departure_km: number | null;
  service_start_at: string | null;
  service_start_km: number | null;
  service_end_at: string | null;
  service_end_km: number | null;
  garage_return_at: string | null;
  garage_return_km: number | null;
  mit_fdse_protocol_code_it: string | null;
  mit_fdse_transmitted_at: string | null;
  interbus_eu_waybill_number: string | null;
  passenger_manifest: PtrManifestPassenger[];
  digital_signature_hash: string | null;
  has_pdf: boolean;
}

export interface PtrServiceSheetPayload {
  garage_departure_at?: string | null;
  garage_departure_km?: number | null;
  service_start_at?: string | null;
  service_start_km?: number | null;
  service_end_at?: string | null;
  service_end_km?: number | null;
  garage_return_at?: string | null;
  garage_return_km?: number | null;
  passenger_manifest?: PtrManifestPassenger[] | null;
}

export interface PtrGenerateSheetPayload extends PtrServiceSheetPayload {
  close?: boolean;
  transmit?: boolean;
  invoice?: boolean;
}

export interface PtrGenerateSheetResult {
  sheet: PtrServiceSheet;
  invoice: { id: string; invoice_number: string; total_gross: string } | null;
}

export interface PtrWelcomeSign {
  text: string;
  greeting: string;
  logo_data_uri: string | null;
}

// --- Contracts ---

export interface PtrRateCardRoute {
  route_code: string;
  origin_label: string;
  destination_label: string;
  vehicle_category: PtrVehicleCategory;
  price: PtrDecimal;
  origin_country?: string | null;
  destination_country?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  border_crossing?: PtrBorderCrossing | null;
  total_km?: PtrDecimal | null;
  it_km?: PtrDecimal | null;
  ch_km?: PtrDecimal | null;
}

export interface PtrHotelContract {
  id: string;
  contact_id: string;
  contact_name?: string | null;
  code: string;
  name: string;
  commission_rate: PtrDecimal;
  currency: string;
  rate_card: PtrRateCardRoute[];
  valid_from: string | null;
  valid_to: string | null;
  billing_cycle: string;
  is_active: boolean;
}

export interface PtrHotelContractPayload {
  contact_id: string;
  code: string;
  name: string;
  commission_rate?: PtrDecimal;
  currency?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
  rate_card?: PtrRateCardRoute[];
}

export interface PtrSchoolRateRoute {
  route_code: string;
  label: string;
  price: PtrDecimal;
}

export interface PtrSchoolContract {
  id: string;
  contact_id: string;
  contact_name?: string | null;
  code: string;
  name: string;
  currency: string;
  rate_card: PtrSchoolRateRoute[];
  monthly_flat_amount: PtrDecimal | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
}

export interface PtrSchoolContractPayload {
  contact_id: string;
  code: string;
  name: string;
  currency?: string;
  monthly_flat_amount?: PtrDecimal | null;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
  rate_card?: PtrSchoolRateRoute[];
}

export interface PtrConciergeBookingPayload {
  route_code: string;
  pickup_datetime: string;
  lead_passenger_name: string;
  lead_passenger_phone?: string | null;
  vip_welcome_sign_text?: string | null;
  passengers_count?: number;
  luggage_count?: number;
  child_seats_spec?: PtrChildSeats | null;
  accessibility_notes?: string | null;
  flight_or_train_number?: string | null;
  flight_carrier_iata?: string | null;
  arrival_airport_iata?: string | null;
  scheduled_flight_arrival_at?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
}

// --- Billing and service exchange ---

export interface PtrBillingPreviewRow {
  customer_id: string;
  customer_name: string | null;
  currency: string | null;
  bookings_count: number;
  booking_ids: string[];
  booking_codes: string[];
  monthly_flat_amount: string | null;
  total_net: string;
  total_tax: string;
  total_gross: string;
  concierge_commission: string;
}

export interface PtrInvoiceResult {
  customer_id: string;
  invoice_id: string;
  invoice_number: string;
  bookings_count: number;
  total_gross: string;
}

export interface PtrBookingInvoice {
  invoice_id: string;
  invoice_number: string;
  total_gross: string;
  booking: PtrBooking;
}

export interface PtrLedgerRow {
  booking_id: string;
  booking_code: string;
  direction: PtrExchangeDirection;
  carrier_id: string;
  carrier_name: string | null;
  pickup_datetime: string;
  route: string;
  agreed_price_net: string;
  payout: string;
  commission: string;
  currency: string;
}

export interface PtrLedgerPartner {
  carrier_id: string;
  carrier_name: string | null;
  currency: string;
  ceded_count: number;
  ceded_payout: string;
  ceded_commission_kept: string;
  acquired_count: number;
  acquired_payout: string;
  acquired_commission_owed: string;
  net_balance: string;
}

export interface PtrLedger {
  rows: PtrLedgerRow[];
  partners: PtrLedgerPartner[];
}
