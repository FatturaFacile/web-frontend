import { Routes } from '@angular/router';

export const PROFESSIONALS_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Studi Professionali', title: 'Studi Professionali' },
    loadComponent: () =>
      import('./professionals.component').then((m) => m.ProfessionalsComponent),
  },
];
