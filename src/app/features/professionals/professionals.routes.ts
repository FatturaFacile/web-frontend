import { Routes } from '@angular/router';

export const PROFESSIONALS_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'BREADCRUMB.STUDI_PROFESSIONALI', title: 'PAGE_TITLE.STUDI_PROFESSIONALI' },
    loadComponent: () =>
      import('./professionals.component').then((m) => m.ProfessionalsComponent),
  },
];
