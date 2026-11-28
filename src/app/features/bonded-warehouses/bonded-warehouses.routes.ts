import { Routes } from '@angular/router';

/** Bonded warehouses, IVA warehouses and AEO (Mod 353). The parent route guards the module (see `app.routes.ts`). */
export const BONDED_WAREHOUSES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    data: {
      breadcrumb: 'NAV.BONDED_WAREHOUSES_DASHBOARD',
      title: 'PAGE_TITLE.BONDED_WAREHOUSES_DASHBOARD',
    },
    loadComponent: () =>
      import('./bonded-dashboard.component').then((m) => m.BondedDashboardComponent),
  },
  {
    path: 'mrn-ledger',
    data: {
      breadcrumb: 'NAV.BONDED_WAREHOUSES_MRN_LEDGER',
      title: 'PAGE_TITLE.BONDED_WAREHOUSES_MRN_LEDGER',
    },
    loadComponent: () =>
      import('./bonded-mrn-ledger.component').then((m) => m.BondedMrnLedgerComponent),
  },
  {
    path: 'vat-register',
    data: {
      breadcrumb: 'NAV.BONDED_WAREHOUSES_VAT_REGISTER',
      title: 'PAGE_TITLE.BONDED_WAREHOUSES_VAT_REGISTER',
    },
    loadComponent: () =>
      import('./bonded-vat-register.component').then((m) => m.BondedVatRegisterComponent),
  },
  {
    path: 'aeo',
    data: {
      breadcrumb: 'NAV.BONDED_WAREHOUSES_AEO',
      title: 'PAGE_TITLE.BONDED_WAREHOUSES_AEO',
    },
    loadComponent: () =>
      import('./bonded-aeo-console.component').then((m) => m.BondedAeoConsoleComponent),
  },
  {
    path: 'authorizations',
    data: {
      breadcrumb: 'NAV.BONDED_WAREHOUSES_AUTHORIZATIONS',
      title: 'PAGE_TITLE.BONDED_WAREHOUSES_AUTHORIZATIONS',
    },
    loadComponent: () =>
      import('./bonded-authorizations.component').then((m) => m.BondedAuthorizationsComponent),
  },
];
