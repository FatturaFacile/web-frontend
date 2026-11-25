import { Routes } from '@angular/router';
import { moduleGuard } from '@core/auth/auth.guard';
import { EXPENSE_MANAGEMENT_FINANCE_MODULE } from './expense-management.util';

/** Expense and travel management (Mod 075). The parent route guards the module (see `app.routes.ts`). */
export const EXPENSE_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.EXPENSE_MANAGEMENT_REPORTS',
      title: 'PAGE_TITLE.EXPENSE_MANAGEMENT_REPORTS',
    },
    loadComponent: () => import('./reports.component').then((m) => m.ReportsComponent),
  },
  {
    path: 'reports/:id',
    data: {
      breadcrumb: 'NAV.EXPENSE_MANAGEMENT_REPORT',
      title: 'PAGE_TITLE.EXPENSE_MANAGEMENT_REPORT',
    },
    loadComponent: () => import('./report-detail.component').then((m) => m.ReportDetailComponent),
  },
  {
    path: 'workbench',
    data: {
      breadcrumb: 'NAV.EXPENSE_MANAGEMENT_WORKBENCH',
      title: 'PAGE_TITLE.EXPENSE_MANAGEMENT_WORKBENCH',
    },
    loadComponent: () =>
      import('./receipt-workbench.component').then((m) => m.ReceiptWorkbenchComponent),
  },
  {
    // The corporate card reconciliation is the finance ability.
    path: 'cards',
    canActivate: [moduleGuard(EXPENSE_MANAGEMENT_FINANCE_MODULE)],
    data: {
      breadcrumb: 'NAV.EXPENSE_MANAGEMENT_CARDS',
      title: 'PAGE_TITLE.EXPENSE_MANAGEMENT_CARDS',
    },
    loadComponent: () => import('./cards.component').then((m) => m.CardsComponent),
  },
  {
    path: 'violations',
    data: {
      breadcrumb: 'NAV.EXPENSE_MANAGEMENT_VIOLATIONS',
      title: 'PAGE_TITLE.EXPENSE_MANAGEMENT_VIOLATIONS',
    },
    loadComponent: () => import('./violations.component').then((m) => m.ViolationsComponent),
  },
];
