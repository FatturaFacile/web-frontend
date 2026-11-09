import { Routes } from '@angular/router';

export const HOSPITALITY_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Ristorazione & Comande', title: 'Ristorazione & Hospitality' },
    loadComponent: () =>
      import('./hospitality.component').then((m) => m.HospitalityComponent),
  },
];
