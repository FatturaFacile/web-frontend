import { Routes } from '@angular/router';
import { SwissVatStore } from './swiss-vat.store';

export const SWISS_VAT_ROUTES: Routes = [
  {
    path: '',
    providers: [SwissVatStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'returns' },
      {
        path: 'returns',
        data: { breadcrumb: 'NAV.SWISS_VAT_RETURNS', title: 'PAGE_TITLE.SWISS_VAT' },
        loadComponent: () =>
          import('./swiss-vat-returns.component').then((m) => m.SwissVatReturnsComponent),
      },
      {
        path: 'config',
        data: { breadcrumb: 'NAV.SWISS_VAT_CONFIG', title: 'PAGE_TITLE.SWISS_VAT' },
        loadComponent: () =>
          import('./swiss-vat-config.component').then((m) => m.SwissVatConfigComponent),
      },
      {
        path: 'bezugsteuer',
        data: { breadcrumb: 'NAV.SWISS_VAT_BEZUGSTEUER', title: 'PAGE_TITLE.SWISS_VAT' },
        loadComponent: () =>
          import('./swiss-vat-bezugsteuer.component').then((m) => m.SwissVatBezugsteuerComponent),
      },
      {
        path: 'adjustments',
        data: { breadcrumb: 'NAV.SWISS_VAT_ADJUSTMENTS', title: 'PAGE_TITLE.SWISS_VAT' },
        loadComponent: () =>
          import('./swiss-vat-adjustments.component').then((m) => m.SwissVatAdjustmentsComponent),
      },
      {
        path: 'reconciliation/:id',
        data: { breadcrumb: 'NAV.SWISS_VAT_RETURNS', title: 'PAGE_TITLE.SWISS_VAT' },
        loadComponent: () =>
          import('./swiss-vat-reconciliation.component').then(
            (m) => m.SwissVatReconciliationComponent,
          ),
      },
    ],
  },
];
