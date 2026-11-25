import { Routes } from '@angular/router';

export const RETURNS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.RETURNS_DASHBOARD', title: 'PAGE_TITLE.RETURNS_DASHBOARD' },
    loadComponent: () => import('./returns-dashboard.component').then((m) => m.ReturnsDashboardComponent),
  },
  {
    path: 'rmas',
    data: { breadcrumb: 'NAV.RETURNS_RMAS', title: 'PAGE_TITLE.RETURNS_RMAS' },
    loadComponent: () => import('./returns-rmas.component').then((m) => m.ReturnsRmasComponent),
  },
  {
    path: 'rmas/:id',
    data: { breadcrumb: 'NAV.RETURNS_RMA_DETAIL', title: 'PAGE_TITLE.RETURNS_RMA_DETAIL' },
    loadComponent: () => import('./returns-rma-detail.component').then((m) => m.ReturnsRmaDetailComponent),
  },
  {
    path: 'warranties',
    data: { breadcrumb: 'NAV.RETURNS_WARRANTIES', title: 'PAGE_TITLE.RETURNS_WARRANTIES' },
    loadComponent: () => import('./returns-warranties.component').then((m) => m.ReturnsWarrantiesComponent),
  },
  {
    path: 'claims',
    data: { breadcrumb: 'NAV.RETURNS_CLAIMS', title: 'PAGE_TITLE.RETURNS_CLAIMS' },
    loadComponent: () => import('./returns-claims.component').then((m) => m.ReturnsClaimsComponent),
  },
  {
    path: 'supplier-returns',
    data: { breadcrumb: 'NAV.RETURNS_SUPPLIER', title: 'PAGE_TITLE.RETURNS_SUPPLIER' },
    loadComponent: () => import('./returns-supplier-returns.component').then((m) => m.ReturnsSupplierReturnsComponent),
  },
  {
    path: 'settings',
    data: { breadcrumb: 'NAV.RETURNS_SETTINGS', title: 'PAGE_TITLE.RETURNS_SETTINGS' },
    loadComponent: () => import('./returns-settings.component').then((m) => m.ReturnsSettingsComponent),
  },
  {
    path: 'portal',
    data: { breadcrumb: 'NAV.RETURNS_PORTAL', title: 'PAGE_TITLE.RETURNS_PORTAL' },
    loadComponent: () => import('./returns-portal.component').then((m) => m.ReturnsPortalComponent),
  },
  {
    path: 'advance-replacements',
    data: { breadcrumb: 'NAV.RETURNS_ADVANCE_REPLACEMENTS', title: 'PAGE_TITLE.RETURNS_ADVANCE_REPLACEMENTS' },
    loadComponent: () => import('./returns-advance-replacements.component').then((m) => m.ReturnsAdvanceReplacementsComponent),
  },
  {
    path: 'grading-bench',
    data: { breadcrumb: 'NAV.RETURNS_GRADING_BENCH', title: 'PAGE_TITLE.RETURNS_GRADING_BENCH' },
    loadComponent: () => import('./returns-grading-bench.component').then((m) => m.ReturnsGradingBenchComponent),
  },
  {
    path: 'credit-notes',
    data: { breadcrumb: 'NAV.RETURNS_CREDIT_NOTES', title: 'PAGE_TITLE.RETURNS_CREDIT_NOTES' },
    loadComponent: () => import('./returns-credit-notes.component').then((m) => m.ReturnsCreditNotesComponent),
  },
];
