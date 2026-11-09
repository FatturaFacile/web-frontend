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
    path: 'self-service',
    data: { breadcrumb: 'NAV.HR_SELF_SERVICE', title: 'NAV.HR_SELF_SERVICE' },
    loadComponent: () =>
      import('./self-service/self-service.component').then((m) => m.SelfServiceComponent),
  },
];
