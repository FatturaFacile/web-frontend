import { Routes } from '@angular/router';

/** Down-payment chains (Mod 203). The parent route guards the module (see `app.routes.ts`). */
export const DOWN_PAYMENTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chains' },
  {
    path: 'chains',
    data: {
      breadcrumb: 'NAV.DOWN_PAYMENTS_CHAINS',
      title: 'PAGE_TITLE.DOWN_PAYMENTS_CHAINS',
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./chain-list.component').then((m) => m.ChainListComponent),
      },
      {
        path: ':id',
        data: {
          breadcrumb: 'NAV.DOWN_PAYMENTS_CHAIN_DETAIL',
          title: 'PAGE_TITLE.DOWN_PAYMENTS_CHAIN_DETAIL',
        },
        loadComponent: () =>
          import('./chain-detail-page.component').then((m) => m.ChainDetailPageComponent),
      },
    ],
  },
];
