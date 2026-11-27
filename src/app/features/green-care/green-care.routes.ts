import { Routes } from '@angular/router';

/** Green space maintenance vertical (Mod 126). The parent route guards the module (see `app.routes.ts`). */
export const GREEN_CARE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    data: { breadcrumb: 'NAV.GREEN_CARE_DASHBOARD', title: 'PAGE_TITLE.GREEN_CARE_DASHBOARD' },
    loadComponent: () => import('./green-care-dashboard.component').then((m) => m.GreenCareDashboardComponent),
  },
  {
    path: 'sites',
    data: { breadcrumb: 'NAV.GREEN_CARE_SITES', title: 'PAGE_TITLE.GREEN_CARE_SITES' },
    loadComponent: () => import('./green-care-sites.component').then((m) => m.GreenCareSitesComponent),
  },
  {
    path: 'contracts',
    data: { breadcrumb: 'NAV.GREEN_CARE_CONTRACTS', title: 'PAGE_TITLE.GREEN_CARE_CONTRACTS' },
    loadComponent: () => import('./green-care-contracts.component').then((m) => m.GreenCareContractsComponent),
  },
  {
    path: 'planner',
    data: { breadcrumb: 'NAV.GREEN_CARE_PLANNER', title: 'PAGE_TITLE.GREEN_CARE_PLANNER' },
    loadComponent: () => import('./green-care-planner.component').then((m) => m.GreenCarePlannerComponent),
  },
  {
    path: 'treatments',
    data: { breadcrumb: 'NAV.GREEN_CARE_TREATMENTS', title: 'PAGE_TITLE.GREEN_CARE_TREATMENTS' },
    loadComponent: () => import('./green-care-treatments.component').then((m) => m.GreenCareTreatmentsComponent),
  },
  {
    path: 'waste',
    data: { breadcrumb: 'NAV.GREEN_CARE_WASTE', title: 'PAGE_TITLE.GREEN_CARE_WASTE' },
    loadComponent: () => import('./green-care-waste.component').then((m) => m.GreenCareWasteComponent),
  },
];
