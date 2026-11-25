import { Routes } from '@angular/router';
import { WorkspaceStore } from './workspace.store';

/**
 * Statutory financial statements (Mod 167). The parent route guards the module (see `app.routes.ts`); the workspace
 * of a dossier shares one store with its tabs.
 */
export const STATUTORY_FINANCIALS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'statutoryFinancials.nav.dossiers',
      title: 'statutoryFinancials.title',
    },
    loadComponent: () => import('./dossiers.component').then((m) => m.DossiersComponent),
  },
  {
    path: 'new',
    data: {
      breadcrumb: 'statutoryFinancials.nav.new',
      title: 'statutoryFinancials.wizard.createTitle',
    },
    loadComponent: () => import('./dossier-wizard.component').then((m) => m.DossierWizardComponent),
  },
  {
    path: ':id',
    providers: [WorkspaceStore],
    data: {
      breadcrumb: 'statutoryFinancials.nav.dossier',
      title: 'statutoryFinancials.workspace.title',
    },
    loadComponent: () => import('./workspace.component').then((m) => m.WorkspaceComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'statements' },
      {
        path: 'statements',
        data: {
          breadcrumb: 'statutoryFinancials.tab.statements',
          title: 'statutoryFinancials.tab.statements',
        },
        loadComponent: () => import('./statements.component').then((m) => m.StatementsComponent),
      },
      {
        path: 'notes',
        data: {
          breadcrumb: 'statutoryFinancials.tab.notes',
          title: 'statutoryFinancials.tab.notes',
        },
        loadComponent: () => import('./notes.component').then((m) => m.NotesComponent),
      },
      {
        path: 'indicators',
        data: {
          breadcrumb: 'statutoryFinancials.tab.indicators',
          title: 'statutoryFinancials.tab.indicators',
        },
        loadComponent: () => import('./indicators.component').then((m) => m.IndicatorsComponent),
      },
      {
        path: 'preview',
        data: {
          breadcrumb: 'statutoryFinancials.tab.preview',
          title: 'statutoryFinancials.tab.preview',
        },
        loadComponent: () => import('./preview.component').then((m) => m.PreviewComponent),
      },
      {
        path: 'package',
        data: {
          breadcrumb: 'statutoryFinancials.tab.package',
          title: 'statutoryFinancials.tab.package',
        },
        loadComponent: () => import('./package.component').then((m) => m.PackageComponent),
      },
      {
        path: 'settings',
        data: {
          breadcrumb: 'statutoryFinancials.tab.settings',
          title: 'statutoryFinancials.tab.settings',
        },
        loadComponent: () =>
          import('./dossier-wizard.component').then((m) => m.DossierWizardComponent),
      },
    ],
  },
];

/** The tabs of the workspace, in order: the last segment of their route. */
export const WORKSPACE_TABS = [
  'statements',
  'notes',
  'indicators',
  'preview',
  'package',
  'settings',
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
