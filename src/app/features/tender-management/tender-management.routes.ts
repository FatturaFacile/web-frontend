import { Routes } from '@angular/router';

/** Tender management (Mod 169). The parent route guards the module (see `app.routes.ts`). */
export const TENDER_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.TENDER_MANAGEMENT_PIPELINE',
      title: 'PAGE_TITLE.TENDER_MANAGEMENT_PIPELINE',
    },
    loadComponent: () => import('./pipeline.component').then((m) => m.PipelineComponent),
  },
  {
    path: 'participations/:id',
    data: {
      breadcrumb: 'NAV.TENDER_MANAGEMENT_DETAIL',
      title: 'PAGE_TITLE.TENDER_MANAGEMENT_DETAIL',
    },
    loadComponent: () => import('./tender-detail.component').then((m) => m.TenderDetailComponent),
  },
  {
    path: 'vault',
    data: {
      breadcrumb: 'NAV.TENDER_MANAGEMENT_VAULT',
      title: 'PAGE_TITLE.TENDER_MANAGEMENT_VAULT',
    },
    loadComponent: () => import('./vault.component').then((m) => m.VaultComponent),
  },
  {
    path: 'benchmarks',
    data: {
      breadcrumb: 'NAV.TENDER_MANAGEMENT_BENCHMARKS',
      title: 'PAGE_TITLE.TENDER_MANAGEMENT_BENCHMARKS',
    },
    loadComponent: () => import('./benchmarks.component').then((m) => m.BenchmarksComponent),
  },
];
