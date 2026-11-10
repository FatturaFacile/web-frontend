import { Routes } from '@angular/router';
import { moduleGuard } from '@core';

export const HR_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'employees',
  },
  {
    path: 'employees',
    data: { breadcrumb: 'Dipendenti & Frontalieri', title: 'HR & Payroll' },
    loadComponent: () =>
      import('./hr.component').then((m) => m.HrComponent),
  },
  {
    path: 'employees/:id',
    data: { breadcrumb: 'hrmEmp.title', title: 'hrmEmp.title' },
    loadComponent: () =>
      import('./employee-detail/employee-detail.component').then((m) => m.EmployeeDetailComponent),
  },
  {
    path: 'organization',
    data: { breadcrumb: 'NAV.HR_ORGANIZATION', title: 'NAV.HR_ORGANIZATION' },
    loadComponent: () =>
      import('./organization/organization.component').then((m) => m.OrganizationComponent),
  },
  {
    path: 'collective-agreements',
    data: { breadcrumb: 'NAV.HR_CCNL', title: 'NAV.HR_CCNL' },
    loadComponent: () =>
      import('./collective-agreements/collective-agreements.component').then(
        (m) => m.CollectiveAgreementsComponent,
      ),
  },
  {
    path: 'leave',
    data: { breadcrumb: 'NAV.HR_LEAVE', title: 'NAV.HR_LEAVE' },
    loadComponent: () => import('./leave/leave.component').then((m) => m.LeaveComponent),
  },
  {
    path: 'time',
    data: { breadcrumb: 'NAV.HR_TIME', title: 'NAV.HR_TIME' },
    loadComponent: () => import('./time/time.component').then((m) => m.TimeComponent),
  },
  {
    path: 'payroll',
    data: { breadcrumb: 'NAV.HR_PAYROLL', title: 'NAV.HR_PAYROLL' },
    loadComponent: () => import('./payroll/payroll.component').then((m) => m.PayrollComponent),
  },
  {
    path: 'payroll-compliance',
    canActivate: [moduleGuard('payroll', 'read')],
    data: { breadcrumb: 'NAV.HR_PAYROLL_COMPLIANCE', title: 'NAV.HR_PAYROLL_COMPLIANCE' },
    loadComponent: () =>
      import('./payroll-compliance/payroll-compliance.component').then((m) => m.PayrollComplianceComponent),
  },
  {
    path: 'short-time',
    canActivate: [moduleGuard('payroll', 'read')],
    data: { breadcrumb: 'NAV.HR_SHORT_TIME', title: 'NAV.HR_SHORT_TIME' },
    loadComponent: () => import('./short-time/short-time.component').then((m) => m.ShortTimeComponent),
  },
  {
    path: 'talent',
    data: { breadcrumb: 'NAV.HR_TALENT', title: 'NAV.HR_TALENT' },
    loadComponent: () => import('./talent/talent.component').then((m) => m.TalentComponent),
  },
  {
    path: 'recruiting',
    data: { breadcrumb: 'NAV.HR_RECRUITING', title: 'NAV.HR_RECRUITING' },
    loadComponent: () => import('./recruiting/recruiting.component').then((m) => m.RecruitingComponent),
  },
  {
    path: 'shifts',
    data: { breadcrumb: 'NAV.HR_SHIFTS', title: 'NAV.HR_SHIFTS' },
    loadComponent: () => import('./shifts/shifts.component').then((m) => m.ShiftsComponent),
  },
  {
    path: 'payroll-data',
    data: { breadcrumb: 'NAV.HR_PAYROLL_DATA', title: 'NAV.HR_PAYROLL_DATA' },
    loadComponent: () => import('./payroll-data/payroll-data.component').then((m) => m.PayrollDataComponent),
  },
  {
    path: 'self-service',
    data: { breadcrumb: 'NAV.HR_SELF_SERVICE', title: 'NAV.HR_SELF_SERVICE' },
    loadComponent: () =>
      import('./self-service/self-service.component').then((m) => m.SelfServiceComponent),
  },
];
