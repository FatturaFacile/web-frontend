/** Shift planning (`/hr/shift-*`, `/hr/shifts/*`, absence plan, my shifts). */

export type ShiftCategory = 'working' | 'absence' | 'on_call';
export type ShiftSequencePattern = 'rotation' | 'weekly_without_sunday' | 'weekly_without_weekend' | 'manual';
export type StaffingDayKind = 'weekday' | 'weekend' | 'holiday';

export interface ShiftTypeRecord {
  id: string;
  code: string;
  name: string;
  category: ShiftCategory | string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  is_paid_absence: boolean;
  color: string | null;
  is_active: boolean;
}

export interface ShiftTypePayload {
  code: string;
  name: string;
  category: ShiftCategory;
  start_time?: string | null;
  end_time?: string | null;
  break_minutes?: number;
  is_paid_absence?: boolean;
  color?: string | null;
  is_active?: boolean;
}

export interface ShiftSequenceRecord {
  id: string;
  name: string;
  pattern: ShiftSequencePattern | string;
  steps: (string | null)[];
  skip_holidays: boolean;
  is_active: boolean;
}

export interface ShiftSequencePayload {
  name: string;
  pattern: ShiftSequencePattern;
  steps: (string | null)[];
  skip_holidays?: boolean;
  is_active?: boolean;
}

export interface ShiftSequenceAssignmentPayload {
  employee_id: string;
  shift_sequence_id: string;
  start_date: string;
  end_date?: string | null;
  offset_days?: number;
}

export interface ShiftExceptionPayload {
  exception_date: string;
  employee_id?: string | null;
  department_id?: string | null;
  shift_type_id?: string | null;
  reason?: string | null;
}

export interface StaffingNeedPayload {
  department_id: string;
  shift_type_id: string;
  day_kind: StaffingDayKind;
  required_count: number;
  valid_from: string;
  valid_to?: string | null;
}

export interface PlannedShift {
  id: string;
  work_date: string;
  shift_type_id: string;
  code: string;
  name: string;
  category: ShiftCategory;
  starts_at: string | null;
  ends_at: string | null;
  break_minutes: number;
  planned_minutes: number;
  status: string;
  source: string;
}

export interface ShiftBoardRow {
  employee_id: string;
  employee_name: string;
  department_id: string | null;
  shifts: PlannedShift[];
}

export interface ShiftBoard {
  from: string;
  to: string;
  days: unknown[];
  rows: ShiftBoardRow[];
  coverage: Record<string, unknown>[];
}

export interface ShiftPeriodParams {
  from: string;
  to: string;
  department_id?: string;
  canton?: string;
  acknowledgement_reason?: string;
}

export interface ShiftPeriodPayload {
  from: string;
  to: string;
  department_id?: string | null;
  employee_ids?: string[];
  canton?: string;
  acknowledgement_reason?: string | null;
}

export interface PlaceShiftPayload {
  employee_id: string;
  shift_type_id: string;
  work_date: string;
  note?: string | null;
}

export interface AbsencePlanEntry {
  employee_id: string;
  employee_name: string;
  date: string;
  type: string;
  is_paid: boolean;
  source: string;
}
