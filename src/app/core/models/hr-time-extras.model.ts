/** Working-time extras: schedule groups, badges, presence, payroll view, punches and meals (`/hr/*`). */

export type RoundingMode = 'none' | 'nearest' | 'employee_favour' | 'employer_favour';
export type PunchType = 'In' | 'Out' | 'BreakStart' | 'BreakEnd' | 'Meal';

export interface ScheduleGroupRecord {
  id: string;
  name: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface ScheduleGroupPayload {
  name: string;
  is_active?: boolean;
}

export interface ScheduleGroupRulesPayload {
  valid_from: string;
  tolerance_before_minutes?: number;
  tolerance_after_minutes?: number;
  rounding_minutes?: number;
  rounding_mode?: RoundingMode;
  night_allowance_percent?: number | null;
  sunday_allowance_percent?: number | null;
  holiday_allowance_percent?: number | null;
  daily_allowance_amount?: number | null;
  daily_allowance_minimum_minutes?: number;
}

export interface ScheduleGroupMemberPayload {
  employee_id: string;
  valid_from: string;
  valid_to?: string | null;
}

export interface TimeBadgePayload {
  employee_id: string;
  badge_code: string;
  is_active?: boolean;
}

export interface TimePresenceRow {
  employee_id: string;
  employee_name: string;
  state: string;
  since: string;
  source: string;
}

export interface TimePayrollDay {
  date: string;
  recorded_minutes: number;
  payroll_minutes: number;
  adjustment_minutes: number;
  night_minutes: number;
  night_allowance_minutes: number;
  sunday_allowance_minutes: number;
  holiday_allowance_minutes: number;
  daily_allowance_amount: string;
  rule_id: string | null;
}

export interface TimePayrollTotals {
  recorded_minutes: number;
  payroll_minutes: number;
  night_minutes: number;
  night_allowance_minutes: number;
  sunday_allowance_minutes: number;
  holiday_allowance_minutes: number;
  daily_allowance_amount: string;
  ytd_night_shifts: number;
  is_regular_night_worker: boolean;
  night_compensation_mode: string;
  night_time_compensation_minutes: number;
  night_cash_supplement_minutes: number;
}

export interface TimePayrollView {
  employee_id: string;
  from: string;
  to: string;
  days: TimePayrollDay[];
  totals: TimePayrollTotals;
}

export interface PunchImportItem {
  external_id: string;
  badge_code?: string | null;
  employee_id?: string | null;
  occurred_at: string;
  punch_type: PunchType;
  meal_type?: string | null;
}

export interface PunchImportPayload {
  reader_id: string;
  source?: 'badge' | 'terminal';
  punches: PunchImportItem[];
}

export interface PunchImportResult {
  accepted: number;
  duplicates: number;
  rejected: { external_id: string; reason: string }[];
}

export interface MealBookingPayload {
  employee_id?: string | null;
  meal_type: string;
  occurred_at?: string | null;
  source?: 'badge' | 'terminal' | 'web' | 'mobile' | 'spreadsheet' | 'paper' | 'manual' | null;
  note?: string | null;
}

export interface MealBookingQuery {
  employee_id?: string | null;
  from: string;
  to: string;
}

export interface NightWorkBalance {
  id: string;
  user_id: string;
  employee_id: string | null;
  year: number;
  ytd_night_shifts: number;
  is_regular_night_worker: boolean;
  total_night_minutes: number;
  accrued_rest_minutes: number;
  taken_rest_minutes: number;
  remaining_rest_minutes: number;
  cash_supplement_minutes: number;
  compensation_mode: string;
}

export interface TimeTransferItem {
  employee_id: string;
  worked_minutes: number;
  overtime_minutes: number;
  night_minutes: number;
  sunday_holiday_minutes: number;
}

export interface TimeTransferResult {
  year: number;
  month: number;
  employees_processed: number;
  inputs_upserted: number;
  night_time_bank_credits: number;
  items: TimeTransferItem[];
}
