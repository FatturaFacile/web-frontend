export interface AttendanceRecordDto {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  hoursWorked: number;
  complianceNotice: string;
  status: 'COMPLETED' | 'IN_PROGRESS';
}

export interface AttendanceSummaryDto {
  weeklyHoursWorked: number;
  weeklyLimitHours: number;
  overtimeHours: number;
  vacationDaysAvailable: number;
  statutoryRestCompliant: boolean;
  jurisdiction: 'IT' | 'CH';
  regime: string;
}

export interface VacationAccrualDto {
  annualEntitlementDays: number;
  takenDays: number;
  remainingDays: number;
  rolHoursAvailable: number;
}

export interface TimeAttendanceDto {
  summary: AttendanceSummaryDto;
  todaySession: {
    isClockedIn: boolean;
    clockInTime: string;
    breakMinutes: number;
    totalTodayHours: number;
  };
  records: AttendanceRecordDto[];
  vacations: VacationAccrualDto;
}
