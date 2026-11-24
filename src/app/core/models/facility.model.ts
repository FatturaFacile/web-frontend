/** Envelope of the facility endpoints: the resource (or the list) under `data`. */
export interface FacilityResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export const FACILITY_SPACE_KINDS = ['floor', 'office', 'meeting_room', 'desk', 'parking', 'warehouse', 'common_area'] as const;
export type FacilitySpaceKind = (typeof FACILITY_SPACE_KINDS)[number];

export const FACILITY_BOOKABLE_KINDS = ['office', 'meeting_room', 'desk', 'parking', 'warehouse'] as const;
export type FacilityBookableKind = (typeof FACILITY_BOOKABLE_KINDS)[number];

/** Kinds that cannot contain other spaces. */
export const FACILITY_LEAF_KINDS: readonly FacilitySpaceKind[] = ['desk', 'parking', 'meeting_room'];

export const FACILITY_BOOKING_STATUSES = ['booked', 'checked_in', 'completed', 'cancelled', 'no_show'] as const;
export type FacilityBookingStatus = (typeof FACILITY_BOOKING_STATUSES)[number];

export const FACILITY_REQUEST_CATEGORIES = ['cleaning', 'repair', 'it', 'security', 'hvac', 'other'] as const;
export type FacilityRequestCategory = (typeof FACILITY_REQUEST_CATEGORIES)[number];

export const FACILITY_REQUEST_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type FacilityRequestPriority = (typeof FACILITY_REQUEST_PRIORITIES)[number];

export const FACILITY_REQUEST_STATUSES = ['new', 'assigned', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled'] as const;
export type FacilityRequestStatus = (typeof FACILITY_REQUEST_STATUSES)[number];

export const FACILITY_INSPECTION_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type FacilityInspectionFrequency = (typeof FACILITY_INSPECTION_FREQUENCIES)[number];

export type FacilityChecklistItemType = 'pass_fail' | 'number' | 'text';
export type FacilityInspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export const FACILITY_METER_KINDS = ['electricity', 'gas', 'water'] as const;
export type FacilityMeterKind = (typeof FACILITY_METER_KINDS)[number];

/** Units accepted for each kind of meter. */
export const FACILITY_METER_UNITS: Record<FacilityMeterKind, readonly string[]> = {
  electricity: ['kWh', 'MWh'],
  gas: ['Sm3', 'm3', 'kWh'],
  water: ['m3', 'l'],
};

export const FACILITY_CURRENCIES = ['EUR', 'CHF'] as const;
export type FacilityCurrency = (typeof FACILITY_CURRENCIES)[number];

export type FacilityReadingType = 'regular' | 'rollover' | 'replacement';

export interface FacilityPerson {
  id: string;
  name: string;
}

// Buildings and spaces

export interface FacilityBuilding {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface FacilityBuildingRequest {
  code: string;
  name: string;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface FacilitySpace {
  id: string;
  building_id: string;
  parent_id: string | null;
  kind: FacilitySpaceKind;
  code: string;
  name: string;
  floor_level: number | null;
  capacity: number | null;
  area_sqm: string | null;
  is_bookable: boolean;
  is_active: boolean;
  amenities: string[];
  notes: string | null;
  building?: { id: string; code: string; name: string };
}

export interface FacilitySpaceNode extends Omit<FacilitySpace, 'building' | 'area_sqm' | 'amenities' | 'notes' | 'floor_level'> {
  children: FacilitySpaceNode[];
}

export interface FacilitySpaceRequest {
  building_id: string;
  parent_id?: string | null;
  kind: FacilitySpaceKind;
  code: string;
  name: string;
  floor_level?: number | null;
  capacity?: number | null;
  area_sqm?: number | null;
  is_bookable?: boolean;
  is_active?: boolean;
  amenities?: string[] | null;
  notes?: string | null;
}

// Bookings

export interface FacilityBooking {
  id: string;
  space_id: string;
  series_id: string | null;
  user_id: string | null;
  user?: FacilityPerson | null;
  space?: { id: string; code: string; name: string; kind: FacilitySpaceKind; building_id: string };
  title: string | null;
  attendees: number | null;
  starts_at: string;
  ends_at: string;
  status: FacilityBookingStatus;
  checked_in_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface FacilityBookingRequest {
  space_id: string;
  user_id?: string | null;
  starts_at: string;
  ends_at: string;
  title?: string | null;
  attendees?: number | null;
}

export interface FacilityBookingCheckRequest {
  space_id: string;
  user_id?: string | null;
  booking_id?: string | null;
  starts_at: string;
  ends_at: string;
  attendees?: number | null;
}

export type FacilityViolationCode = 'not_bookable' | 'in_past' | 'too_long' | 'too_far' | 'over_capacity' | 'daily_limit' | 'conflict';

export interface FacilityBookingViolation {
  code: FacilityViolationCode;
  field: string;
  message: string;
}

export interface FacilityBookingRuleValues {
  max_bookings_per_user_per_day: number | null;
  max_minutes_per_booking: number | null;
  max_advance_days: number | null;
  checkin_grace_minutes: number;
  requires_checkin: boolean;
}

export interface FacilityBookingCheckResult {
  available: boolean;
  violations: FacilityBookingViolation[];
  conflicts: FacilityBooking[];
  rules: FacilityBookingRuleValues;
}

export interface FacilityBookingRuleEffective extends FacilityBookingRuleValues {
  space_kind: FacilityBookableKind;
  customized: boolean;
}

export type FacilityBookingRuleRequest = FacilityBookingRuleValues;

export interface FacilityBookingSeriesRequest {
  space_id: string;
  user_id?: string | null;
  recurrence: 'daily' | 'weekly';
  weekdays?: number[] | null;
  start_date: string;
  until_date: string;
  start_time: string;
  end_time: string;
  title?: string | null;
  skip_conflicts?: boolean;
}

export interface FacilityBookingSeriesResult {
  id: string;
  space_id: string;
  status: string;
  occurrences: number;
  created: number;
  skipped: { date: string; reasons: string[] }[];
}

// Service requests

export interface FacilityServiceRequest {
  id: string;
  number: string;
  category: FacilityRequestCategory;
  priority: FacilityRequestPriority;
  status: FacilityRequestStatus;
  title: string;
  description: string | null;
  building_id: string | null;
  space_id: string | null;
  requester_id: string | null;
  assignee_id: string | null;
  requester?: FacilityPerson | null;
  assignee?: FacilityPerson | null;
  asset_id: string | null;
  work_order_id: string | null;
  inspection_id: string | null;
  due_at: string;
  is_overdue: boolean;
  assigned_at: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  hold_reason: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface FacilityServiceRequestRequest {
  category: FacilityRequestCategory;
  priority?: FacilityRequestPriority;
  title: string;
  description?: string | null;
  building_id?: string | null;
  space_id?: string | null;
  asset_id?: string | null;
}

export interface FacilityServiceRequestBoard {
  by_status: Record<FacilityRequestStatus, number>;
  by_priority: Record<FacilityRequestPriority, number>;
  overdue: number;
  open: number;
}

export interface FacilityRequestComment {
  id: string;
  service_request_id: string;
  author_id: string | null;
  author?: FacilityPerson | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface FacilityRequestCommentRequest {
  body: string;
  is_internal?: boolean;
}

// Inspections

export interface FacilityChecklistItem {
  key?: string | null;
  label: string;
  type?: FacilityChecklistItemType;
  required?: boolean;
}

export interface FacilityInspectionTemplate {
  id: string;
  name: string;
  building_id: string | null;
  space_id: string | null;
  frequency: FacilityInspectionFrequency;
  interval_count: number;
  checklist: Required<FacilityChecklistItem>[];
  assignee_id: string | null;
  next_due_date: string;
  lead_days: number;
  last_generated_on: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface FacilityInspectionTemplateRequest {
  name: string;
  building_id?: string | null;
  space_id?: string | null;
  frequency: FacilityInspectionFrequency;
  interval_count?: number;
  checklist: FacilityChecklistItem[];
  assignee_id?: string | null;
  next_due_date: string;
  lead_days?: number;
  is_active?: boolean;
  notes?: string | null;
}

export interface FacilityInspectionItem {
  key: string;
  label: string;
  type: FacilityChecklistItemType;
  required: boolean;
  result: 'pass' | 'fail' | 'na' | null;
  value: string | null;
  notes: string | null;
}

export interface FacilityInspection {
  id: string;
  template_id: string | null;
  number: string;
  title: string;
  building_id: string | null;
  space_id: string | null;
  assignee_id: string | null;
  due_date: string;
  status: FacilityInspectionStatus;
  result: 'pass' | 'fail' | null;
  checklist: FacilityInspectionItem[];
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  service_request_id: string | null;
}

export interface FacilityInspectionAnswer {
  key: string;
  result?: 'pass' | 'fail' | 'na' | null;
  value?: string | null;
  notes?: string | null;
}

export interface FacilityCompleteInspectionRequest {
  answers: FacilityInspectionAnswer[];
  notes?: string | null;
}

// Meters

export interface FacilityMeter {
  id: string;
  building_id: string;
  space_id: string | null;
  kind: FacilityMeterKind;
  code: string;
  name: string;
  unit: string;
  tariff_per_unit: string | null;
  currency: FacilityCurrency;
  rollover_value: string | null;
  is_active: boolean;
  installed_on: string | null;
  last_read_on: string | null;
  last_value: string | null;
  notes: string | null;
}

export interface FacilityMeterRequest {
  building_id: string;
  space_id?: string | null;
  kind: FacilityMeterKind;
  code: string;
  name: string;
  unit: string;
  tariff_per_unit?: number | null;
  currency?: FacilityCurrency;
  rollover_value?: number | null;
  is_active?: boolean;
  installed_on?: string | null;
  notes?: string | null;
}

export interface FacilityMeterReading {
  id: string;
  meter_id: string;
  read_on: string;
  value: string;
  consumption: string;
  cost: string | null;
  currency: string | null;
  reading_type: FacilityReadingType;
  notes: string | null;
}

export interface FacilityMeterReadingRequest {
  read_on: string;
  value: number;
  reading_type?: FacilityReadingType;
  notes?: string | null;
}

export interface FacilityMeterSummary {
  year: number;
  rows: { month: string; kind: FacilityMeterKind; unit: string; currency: string | null; consumption: string; cost: string | null; readings: number }[];
  totals: { kind: FacilityMeterKind; unit: string; currency: string | null; consumption: string; cost: string | null }[];
}

export interface FacilityOverview {
  buildings: number;
  spaces: number;
  bookable_spaces: number;
  bookings_today: number;
  my_upcoming_bookings: number;
  requests: FacilityServiceRequestBoard;
  inspections: { open: number; overdue: number };
  requests_sla_hours: Record<FacilityRequestPriority, number>;
}
