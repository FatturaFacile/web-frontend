import { Routes } from '@angular/router';

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
    path: 'self-service',
    data: { breadcrumb: 'NAV.HR_SELF_SERVICE', title: 'NAV.HR_SELF_SERVICE' },
    loadComponent: () =>
      import('./self-service/self-service.component').then((m) => m.SelfServiceComponent),
  },
];
