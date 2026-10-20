import { Routes } from '@angular/router';

export const PURCHASES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'sdi-inbox',
  },
  {
    path: 'sdi-inbox',
    data: { breadcrumb: 'Ciclo Passivo SDI', title: 'Ciclo Passivo SDI' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'qr-scanner',
    data: { breadcrumb: 'Scanner QR & pain.001', title: 'Scanner QR & pain.001' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'expenses',
    data: { breadcrumb: 'Note Spese', title: 'Note Spese' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
];
