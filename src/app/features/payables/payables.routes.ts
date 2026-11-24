import { Routes } from '@angular/router';

export const PAYABLES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.PAYABLES_ITEMS', title: 'PAGE_TITLE.PAYABLES_ITEMS' },
    loadComponent: () => import('./payables-items.component').then((m) => m.PayablesItemsComponent),
  },
  {
    path: 'batches',
    data: { breadcrumb: 'NAV.PAYABLES_BATCHES', title: 'PAGE_TITLE.PAYABLES_BATCHES' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./payables-batches.component').then((m) => m.PayablesBatchesComponent),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./payables-batch-wizard.component').then((m) => m.PayablesBatchWizardComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./payables-batch-detail.component').then((m) => m.PayablesBatchDetailComponent),
      },
    ],
  },
  {
    path: 'aging',
    data: { breadcrumb: 'NAV.PAYABLES_AGING', title: 'PAGE_TITLE.PAYABLES_AGING' },
    loadComponent: () => import('./payables-aging.component').then((m) => m.PayablesAgingComponent),
  },
];
