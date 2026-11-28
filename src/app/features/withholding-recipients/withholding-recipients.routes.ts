import { Routes } from '@angular/router';

/** Withholding taxes on commissions, royalties, occasional work and amateur sports (Mod 356). The parent route guards the module (see `app.routes.ts`). */
export const WITHHOLDING_RECIPIENTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.WITHHOLDING_RECIPIENTS_DASHBOARD',
      title: 'PAGE_TITLE.WITHHOLDING_RECIPIENTS_DASHBOARD',
    },
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'simulator',
    data: {
      breadcrumb: 'NAV.WITHHOLDING_RECIPIENTS_SIMULATOR',
      title: 'PAGE_TITLE.WITHHOLDING_RECIPIENTS_SIMULATOR',
    },
    loadComponent: () => import('./simulator.component').then((m) => m.SimulatorComponent),
  },
  {
    // Posting, the F24 / UniEmens flows and the annual records are gated inside the page by the `settle` ability.
    path: 'settlements',
    data: {
      breadcrumb: 'NAV.WITHHOLDING_RECIPIENTS_SETTLEMENTS',
      title: 'PAGE_TITLE.WITHHOLDING_RECIPIENTS_SETTLEMENTS',
    },
    loadComponent: () =>
      import('./settlement-center.component').then((m) => m.SettlementCenterComponent),
  },
];
