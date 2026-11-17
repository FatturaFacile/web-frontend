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
    path: 'recruiting',
    data: { breadcrumb: 'NAV.RECRUITING' },
    loadChildren: () =>
      import('./recruiting/recruiting.routes').then((m) => m.RECRUITING_ROUTES),
  },
];
