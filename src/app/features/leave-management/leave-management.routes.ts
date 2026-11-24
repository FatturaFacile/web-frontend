import { Routes } from '@angular/router';
import { LeaveManagementStore } from './leave-management.store';

export const LEAVE_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    providers: [LeaveManagementStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'gantt' },
      {
        path: 'gantt',
        data: { breadcrumb: 'NAV.LEAVE_MANAGEMENT_GANTT', title: 'PAGE_TITLE.LEAVE_MANAGEMENT' },
        loadComponent: () =>
          import('./department-gantt-calendar.component').then(
            (m) => m.DepartmentGanttCalendarComponent,
          ),
      },
      {
        path: 'ledgers',
        data: { breadcrumb: 'NAV.LEAVE_MANAGEMENT_LEDGER', title: 'PAGE_TITLE.LEAVE_MANAGEMENT' },
        loadComponent: () =>
          import('./accrual-ledgers.component').then((m) => m.AccrualLedgersComponent),
      },
      {
        path: 'requests',
        data: { breadcrumb: 'NAV.LEAVE_MANAGEMENT_REQUESTS', title: 'PAGE_TITLE.LEAVE_MANAGEMENT' },
        loadComponent: () =>
          import('./leave-requests.component').then((m) => m.LeaveRequestsComponent),
      },
      {
        path: 'comporto',
        data: { breadcrumb: 'NAV.LEAVE_MANAGEMENT_COMPORTO', title: 'PAGE_TITLE.LEAVE_MANAGEMENT' },
        loadComponent: () =>
          import('./comporto-curtailment.component').then((m) => m.ComportoCurtailmentComponent),
      },
      {
        path: 'holidays',
        data: { breadcrumb: 'NAV.LEAVE_MANAGEMENT_HOLIDAYS', title: 'PAGE_TITLE.LEAVE_MANAGEMENT' },
        loadComponent: () =>
          import('./holiday-calendars.component').then((m) => m.HolidayCalendarsComponent),
      },
      {
        path: 'policies',
        data: { breadcrumb: 'NAV.LEAVE_MANAGEMENT_POLICIES', title: 'PAGE_TITLE.LEAVE_MANAGEMENT' },
        loadComponent: () =>
          import('./leave-policies.component').then((m) => m.LeavePoliciesComponent),
      },
    ],
  },
];
