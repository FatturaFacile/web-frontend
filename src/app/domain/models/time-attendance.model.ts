export interface AttendanceRecord {
  readonly id: string;
  readonly date: string;
  readonly clockIn: string;
  readonly clockOut: string | null;
  readonly breakMinutes: number;
  readonly hoursWorked: number;
  readonly complianceNotice: string;
  readonly status: 'COMPLETED' | 'IN_PROGRESS';
}

export interface AttendanceSummary {
  readonly weeklyHoursWorked: number;
  readonly weeklyLimitHours: number;
  readonly overtimeHours: number;
  readonly vacationDaysAvailable: number;
  readonly statutoryRestCompliant: boolean;
  readonly jurisdiction: 'IT' | 'CH';
  readonly regime: string;
}

export interface VacationAccrual {
  readonly annualEntitlementDays: number;
  readonly takenDays: number;
  readonly remainingDays: number;
  readonly rolHoursAvailable: number;
}

export interface TimeAttendanceData {
  readonly summary: AttendanceSummary;
  readonly todaySession: {
    readonly isClockedIn: boolean;
    readonly clockInTime: string;
    readonly breakMinutes: number;
    readonly totalTodayHours: number;
  };
  readonly records: readonly AttendanceRecord[];
  readonly vacations: VacationAccrual;
}
