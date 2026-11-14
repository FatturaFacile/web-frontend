/** Business trips and travel expenses (API module `travel`). Amounts are decimal strings. */

export type TravelTripStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'reconciled';

export type TravelJurisdiction = 'IT' | 'CH';
export type TravelCurrency = 'EUR' | 'CHF';
export type TravelLegType = 'flight' | 'train' | 'car' | 'hotel';
export type TravelBookingStatus = 'planned' | 'booked' | 'cancelled';
export type TravelVehicleType = 'car' | 'motorcycle' | 'bicycle';
export type TravelRateScope = 'domestic' | 'abroad';
export type TravelBalanceDirection = 'owed_to_employee' | 'owed_by_employee' | 'settled';

export const TRAVEL_TRIP_STATUSES: readonly TravelTripStatus[] = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'completed',
  'reconciled',
];
export const TRAVEL_LEG_TYPES: readonly TravelLegType[] = ['flight', 'train', 'car', 'hotel'];
export const TRAVEL_BOOKING_STATUSES: readonly TravelBookingStatus[] = [
  'planned',
  'booked',
  'cancelled',
];
export const TRAVEL_VEHICLE_TYPES: readonly TravelVehicleType[] = ['car', 'motorcycle', 'bicycle'];
export const TRAVEL_JURISDICTIONS: readonly TravelJurisdiction[] = ['IT', 'CH'];
export const TRAVEL_CURRENCIES: readonly TravelCurrency[] = ['EUR', 'CHF'];
export const TRAVEL_RATE_SCOPES: readonly TravelRateScope[] = ['domestic', 'abroad'];

export interface TravelEmployee {
  id: string;
  name: string;
}

export interface TravelLeg {
  id: string;
  trip_id: string;
  sequence: number;
  leg_type: TravelLegType;
  from_location: string | null;
  to_location: string;
  departs_at: string | null;
  arrives_at: string | null;
  provider: string | null;
  booking_reference: string | null;
  booking_status: TravelBookingStatus;
  booked_cost: string;
  currency: string;
  notes: string | null;
}

export interface TravelPerDiemDay {
  id: string;
  day: string;
  hours_away: string;
  day_factor: string;
  breakfast_provided: boolean;
  lunch_provided: boolean;
  dinner_provided: boolean;
  lodging_provided: boolean;
  currency: string;
  gross_amount: string;
  deduction_amount: string;
  amount: string;
  tax_free_amount: string;
  taxable_amount: string;
}

export interface TravelMileageClaim {
  id: string;
  trip_id: string;
  travel_date: string;
  from_location: string;
  to_location: string;
  vehicle_type: TravelVehicleType;
  round_trip: boolean;
  distance_km: string;
  rate_per_km: string;
  currency: string;
  amount: string;
  notes: string | null;
}

export interface TravelTrip {
  id: string;
  number: string;
  user_id: string;
  employee?: TravelEmployee | null;
  purpose: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  departure_time: string | null;
  return_time: string | null;
  currency: string;
  rate_jurisdiction: TravelJurisdiction;
  estimated_budget: string;
  advance_amount: string;
  advance_paid_at: string | null;
  status: TravelTripStatus;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  reconciled_expenses_total: string | null;
  reconciled_per_diem_total: string | null;
  reconciled_mileage_total: string | null;
  reconciled_advance_total: string | null;
  reconciled_balance: string | null;
  reconciled_direction: TravelBalanceDirection | null;
  legs?: TravelLeg[];
  per_diem_days?: TravelPerDiemDay[];
  mileage_claims?: TravelMileageClaim[];
  created_at: string;
}

export interface TravelTripRequest {
  user_id?: string | null;
  purpose: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  departure_time?: string | null;
  return_time?: string | null;
  currency?: TravelCurrency | null;
  rate_jurisdiction?: TravelJurisdiction | null;
  estimated_budget?: string | null;
  advance_amount?: string | null;
}

export interface TravelApproveRequest {
  advance_amount?: string | null;
}

export interface TravelRejectRequest {
  reason: string;
}

export interface TravelAdvancePaidRequest {
  paid_at: string;
}

export interface TravelLegRequest {
  leg_type: TravelLegType;
  sequence?: number | null;
  from_location?: string | null;
  to_location: string;
  departs_at?: string | null;
  arrives_at?: string | null;
  provider?: string | null;
  booking_reference?: string | null;
  booking_status?: TravelBookingStatus | null;
  booked_cost?: string | null;
  currency?: string | null;
  notes?: string | null;
}

export interface TravelPerDiemDayRequest {
  day: string;
  breakfast_provided?: boolean | null;
  lunch_provided?: boolean | null;
  dinner_provided?: boolean | null;
  lodging_provided?: boolean | null;
}

export interface TravelPerDiemRequest {
  days?: TravelPerDiemDayRequest[] | null;
}

export interface TravelPerDiemResponse {
  data: TravelPerDiemDay[];
  totals: { amount: string; tax_free_amount: string; taxable_amount: string; currency: string };
}

export interface TravelMileageClaimRequest {
  travel_date: string;
  from_location: string;
  to_location: string;
  vehicle_type: TravelVehicleType;
  round_trip?: boolean | null;
  distance_km: string;
  notes?: string | null;
}

export interface TravelLinkExpenseRequest {
  expense_id: string;
}

export interface TravelLinkedExpense {
  id: string;
  expense_number: string;
  date: string;
  merchant_name: string | null;
  amount: string;
  currency: string;
  status: string;
  counted: boolean;
}

export interface TravelReconciliation {
  currency: string;
  per_diem_total: string;
  per_diem_taxable_total: string;
  mileage_total: string;
  expenses_total: string;
  total_due: string;
  advance_amount: string;
  advance_paid: string;
  balance: string;
  balance_amount: string;
  direction: TravelBalanceDirection;
  pending_expenses: number;
  rejected_expenses: number;
  expenses: TravelLinkedExpense[];
}

export interface TravelTripReport {
  trip: TravelTrip;
  budget: {
    currency: string;
    estimated: string;
    booked_itinerary: string;
    booked_by_type: Record<string, string>;
    actual: string;
    variance: string;
    utilization_percent: string | null;
    within_budget: boolean;
  };
  reconciliation: TravelReconciliation;
  frozen: boolean;
}

export interface TravelPerDiemRate {
  id: string;
  jurisdiction: TravelJurisdiction;
  year: number;
  scope: TravelRateScope;
  country: string | null;
  currency: string;
  daily_amount: string;
  tax_free_daily_amount: string | null;
  lodging_deduction_percent: string;
  breakfast_deduction_percent: string;
  meal_deduction_percent: string;
  deduct_each_meal: boolean;
  half_day_min_hours: number;
  full_day_min_hours: number;
  notes: string | null;
}

export interface TravelPerDiemRateRequest {
  jurisdiction: TravelJurisdiction;
  year: number;
  scope: TravelRateScope;
  country?: string | null;
  currency: TravelCurrency;
  daily_amount: string;
  tax_free_daily_amount?: string | null;
  lodging_deduction_percent?: string | null;
  breakfast_deduction_percent?: string | null;
  meal_deduction_percent?: string | null;
  deduct_each_meal?: boolean | null;
  half_day_min_hours?: number | null;
  full_day_min_hours?: number | null;
  notes?: string | null;
}

export interface TravelMileageRate {
  id: string;
  jurisdiction: TravelJurisdiction;
  year: number;
  vehicle_type: TravelVehicleType;
  currency: string;
  rate_per_km: string;
  notes: string | null;
}

export interface TravelMileageRateRequest {
  jurisdiction: TravelJurisdiction;
  year: number;
  vehicle_type: TravelVehicleType;
  currency: TravelCurrency;
  rate_per_km: string;
  notes?: string | null;
}

export interface TravelSeedRatesRequest {
  jurisdiction: TravelJurisdiction;
  year: number;
}

export interface TravelSeedRatesResult {
  per_diem_created: number;
  mileage_created: number;
}

export interface TravelTripFilters {
  status?: TravelTripStatus;
  user_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}
