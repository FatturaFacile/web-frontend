import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DeadlineAlertLevelCode, LeaveRequestStatusCode, LeaveTypeEnum } from '@core';

export const LEAVE_TYPE_OPTIONS: readonly LeaveTypeEnum[] = [
  'AnnualVacation_Ferie_Ferien',
  'IT_PermessiROL',
  'IT_ExFestivita',
  'SickLeave_Malattia',
  'Accident_Infortunio_SUVA_INAIL',
  'MaternityPaternity_Congedo',
  'IT_Legge104_Permessi',
  'CH_MilitaryCivilService_EO_APG',
  'PaidSpecialLeave_MarriageBereavement',
  'UnpaidLeave',
];

export const SWISS_CANTONS: readonly string[] = [
  'AG',
  'AI',
  'AR',
  'BE',
  'BL',
  'BS',
  'FR',
  'GE',
  'GL',
  'GR',
  'JU',
  'LU',
  'NE',
  'NW',
  'OW',
  'SG',
  'SH',
  'SO',
  'SZ',
  'TG',
  'TI',
  'UR',
  'VD',
  'VS',
  'ZG',
  'ZH',
];

export const STATUS_TAG_COLORS: Readonly<Record<LeaveRequestStatusCode, string>> = {
  draft: 'default',
  pending_approval: 'gold',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
};

export const DEADLINE_ALERT_COLORS: Readonly<Record<DeadlineAlertLevelCode, string>> = {
  none: 'default',
  warning: 'orange',
  critical: 'volcano',
  expired: 'red',
};

export const LEAVE_TYPE_TAG_COLORS: Readonly<Record<LeaveTypeEnum, string>> = {
  AnnualVacation_Ferie_Ferien: 'blue',
  IT_PermessiROL: 'cyan',
  IT_ExFestivita: 'geekblue',
  SickLeave_Malattia: 'volcano',
  Accident_Infortunio_SUVA_INAIL: 'red',
  MaternityPaternity_Congedo: 'purple',
  IT_Legge104_Permessi: 'magenta',
  CH_MilitaryCivilService_EO_APG: 'gold',
  PaidSpecialLeave_MarriageBereavement: 'lime',
  UnpaidLeave: 'default',
};

/** Validates Italian INPS telematic medical certificate protocol number (9 alphanumeric characters). */
export function isValidInpsPuc(raw: string | null | undefined): boolean {
  if (!raw) {
    return false;
  }
  return /^[A-Za-z0-9]{9}$/.test(raw.trim());
}

/** Reactive Form validator for optional or required 9-character INPS PUC protocol. */
export function inpsPucValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = typeof control.value === 'string' ? control.value.trim() : '';
    if (val === '') {
      return null;
    }
    return isValidInpsPuc(val) ? null : { invalidInpsPuc: true };
  };
}

/** Checks if a calendar date falls inside an employee's leave span. */
export function isDateInAbsenceSpan(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}
