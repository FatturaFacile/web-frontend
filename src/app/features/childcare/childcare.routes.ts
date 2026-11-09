import { Routes } from '@angular/router';

export const CHILDCARE_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Infanzia & Asilo Nido', title: 'Infanzia & Asilo Nido' },
    loadComponent: () =>
      import('./childcare.component').then((m) => m.ChildcareComponent),
  },
];
