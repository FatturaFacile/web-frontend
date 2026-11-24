import { Routes } from '@angular/router';
import { moduleGuard } from '@core/auth/auth.guard';
import { AGENT_COMMISSIONS_SETTLE_MODULE } from './agent-commissions.util';

/** Sales commissions and agent management (Mod 041). The parent route guards the module (see `app.routes.ts`). */
export const AGENT_COMMISSIONS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.AGENT_COMMISSIONS_AGENTS',
      title: 'PAGE_TITLE.AGENT_COMMISSIONS_AGENTS',
    },
    loadComponent: () => import('./agents.component').then((m) => m.AgentsComponent),
  },
  {
    path: 'rules',
    data: {
      breadcrumb: 'NAV.AGENT_COMMISSIONS_RULES',
      title: 'PAGE_TITLE.AGENT_COMMISSIONS_RULES',
    },
    loadComponent: () => import('./rules.component').then((m) => m.RulesComponent),
  },
  {
    path: 'ledger',
    data: {
      breadcrumb: 'NAV.AGENT_COMMISSIONS_LEDGER',
      title: 'PAGE_TITLE.AGENT_COMMISSIONS_LEDGER',
    },
    loadComponent: () => import('./ledger.component').then((m) => m.LedgerComponent),
  },
  {
    path: 'enasarco',
    data: {
      breadcrumb: 'NAV.AGENT_COMMISSIONS_ENASARCO',
      title: 'PAGE_TITLE.AGENT_COMMISSIONS_ENASARCO',
    },
    loadComponent: () => import('./enasarco.component').then((m) => m.EnasarcoComponent),
  },
  {
    path: 'statements',
    data: {
      breadcrumb: 'NAV.AGENT_COMMISSIONS_STATEMENTS',
      title: 'PAGE_TITLE.AGENT_COMMISSIONS_STATEMENTS',
    },
    loadComponent: () => import('./statements.component').then((m) => m.StatementsComponent),
  },
  {
    // The compliance exports are the `settle` ability: owners, administrators and accountants.
    path: 'exports',
    canActivate: [moduleGuard(AGENT_COMMISSIONS_SETTLE_MODULE)],
    data: {
      breadcrumb: 'NAV.AGENT_COMMISSIONS_EXPORTS',
      title: 'PAGE_TITLE.AGENT_COMMISSIONS_EXPORTS',
    },
    loadComponent: () => import('./exports.component').then((m) => m.ExportsComponent),
  },
  {
    path: 'settings',
    data: {
      breadcrumb: 'NAV.AGENT_COMMISSIONS_SETTINGS',
      title: 'PAGE_TITLE.AGENT_COMMISSIONS_SETTINGS',
    },
    loadComponent: () => import('./settings.component').then((m) => m.SettingsComponent),
  },
];
