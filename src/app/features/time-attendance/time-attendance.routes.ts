import { Routes } from '@angular/router';
import { TIME_ATTENDANCE_REPOSITORY } from '@domain/repositories/time-attendance.repository';
import { TimeAttendanceHttpRepository } from '@data-access/repositories/time-attendance-http.repository';
import { TimeAttendanceStore } from './state/time-attendance.store';

export const TIME_ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Presenze & Cartellino', title: 'Presenze & Cartellino' },
    providers: [
      { provide: TIME_ATTENDANCE_REPOSITORY, useClass: TimeAttendanceHttpRepository },
      TimeAttendanceStore,
    ],
    loadComponent: () =>
      import('./components/time-attendance.component').then(
        (m) => m.TimeAttendanceComponent
      ),
  },
];
