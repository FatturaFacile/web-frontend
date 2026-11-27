import { Routes } from '@angular/router';

/** Foreign VAT refund (Mod 227). The parent route guards the module (see `app.routes.ts`). */
export const FOREIGN_VAT_REFUND_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    data: {
      breadcrumb: 'NAV.FOREIGN_VAT_DASHBOARD',
      title: 'PAGE_TITLE.FOREIGN_VAT_DASHBOARD',
    },
    loadComponent: () =>
      import('./foreign-vat-dashboard.component').then((m) => m.ForeignVatDashboardComponent),
  },
  {
    path: 'ledger',
    data: {
      breadcrumb: 'NAV.FOREIGN_VAT_LEDGER',
      title: 'PAGE_TITLE.FOREIGN_VAT_LEDGER',
    },
    loadComponent: () =>
      import('./foreign-vat-ledger.component').then((m) => m.ForeignVatLedgerComponent),
  },
  {
    path: 'claims',
    data: {
      breadcrumb: 'NAV.FOREIGN_VAT_CLAIMS',
      title: 'PAGE_TITLE.FOREIGN_VAT_CLAIMS',
    },
    loadComponent: () =>
      import('./foreign-vat-claims.component').then((m) => m.ForeignVatClaimsComponent),
  },
  {
    path: 'configuration',
    data: {
      breadcrumb: 'NAV.FOREIGN_VAT_CONFIG',
      title: 'PAGE_TITLE.FOREIGN_VAT_CONFIG',
    },
    loadComponent: () =>
      import('./foreign-vat-config.component').then((m) => m.ForeignVatConfigComponent),
  },
];
