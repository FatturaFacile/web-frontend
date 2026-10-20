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
];
