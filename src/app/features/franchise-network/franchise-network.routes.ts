import { Routes } from '@angular/router';

/** Franchise network governance (Mod 244). The parent route guards the module (see `app.routes.ts`). */
export const FRANCHISE_NETWORK_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'command' },
  {
    path: 'command',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_COMMAND',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_COMMAND',
    },
    loadComponent: () => import('./command.component').then((m) => m.CommandComponent),
  },
  {
    path: 'stores',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_STORES',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_STORES',
    },
    loadComponent: () => import('./stores.component').then((m) => m.StoresComponent),
  },
  {
    path: 'agreements',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_AGREEMENTS',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_AGREEMENTS',
    },
    loadComponent: () => import('./agreements.component').then((m) => m.AgreementsComponent),
  },
  {
    path: 'formulas',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_FORMULAS',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_FORMULAS',
    },
    loadComponent: () => import('./formulas.component').then((m) => m.FormulasComponent),
  },
  {
    path: 'pushes',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_PUSHES',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_PUSHES',
    },
    loadComponent: () => import('./pushes.component').then((m) => m.PushesComponent),
  },
  {
    path: 'billing',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_BILLING',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_BILLING',
    },
    loadComponent: () => import('./billing.component').then((m) => m.BillingComponent),
  },
  {
    path: 'audits',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_AUDITS',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_AUDITS',
    },
    loadComponent: () => import('./audits.component').then((m) => m.AuditsComponent),
  },
  {
    path: 'audits/:id',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_AUDIT_RUN',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_AUDIT_RUN',
    },
    loadComponent: () => import('./audit-run.component').then((m) => m.AuditRunComponent),
  },
  {
    path: 'portal',
    data: {
      breadcrumb: 'NAV.FRANCHISE_NETWORK_PORTAL',
      title: 'PAGE_TITLE.FRANCHISE_NETWORK_PORTAL',
    },
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
];
