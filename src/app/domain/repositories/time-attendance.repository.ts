import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { TimeAttendanceData } from '../models/time-attendance.model';

export interface TimeAttendanceRepository {
  getData(): Observable<TimeAttendanceData>;
  toggleClock(): Observable<TimeAttendanceData>;
}

export const TIME_ATTENDANCE_REPOSITORY = new InjectionToken<TimeAttendanceRepository>(
  'TIME_ATTENDANCE_REPOSITORY'
);
