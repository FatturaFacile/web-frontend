import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tenant',
  },
  {
    path: 'tenant',
    data: { breadcrumb: 'Impostazioni & Tenant', title: 'Impostazioni Tenant' },
    loadComponent: () =>
      import('./settings.component').then((m) => m.SettingsComponent),
  },
];
