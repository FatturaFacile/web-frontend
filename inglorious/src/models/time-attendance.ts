export interface AttendanceRecord {
  id: string
  date: string
  clockIn: string
  clockOut: string | null
  breakMinutes: number
  hoursWorked: number
  complianceNotice: string
  status: "COMPLETED" | "IN_PROGRESS"
}

export interface AttendanceSummary {
  weeklyHoursWorked: number
  weeklyLimitHours: number
  overtimeHours: number
  vacationDaysAvailable: number
  statutoryRestCompliant: boolean
  jurisdiction: "IT" | "CH"
  regime: string
}

export interface VacationAccrual {
  annualEntitlementDays: number
  takenDays: number
  remainingDays: number
  rolHoursAvailable: number
}

export interface TodaySession {
  isClockedIn: boolean
  /** `HH:mm`. */
  clockInTime: string
  breakMinutes: number
  totalTodayHours: number
}

/** What `GET /time-attendance` answers, without an envelope. */
export interface TimeAttendanceData {
  summary: AttendanceSummary
  todaySession: TodaySession
  records: AttendanceRecord[]
  vacations: VacationAccrual
}
