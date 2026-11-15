import { Routes } from '@angular/router';

export const PROFESSIONALS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'BREADCRUMB.STUDI_PROFESSIONALI', title: 'PAGE_TITLE.STUDI_PROFESSIONALI' },
    loadComponent: () =>
      import('./professionals.component').then((m) => m.ProfessionalsComponent),
  },
  {
    path: 'proposals',
    data: { breadcrumb: 'NAV.PRACTICE_PROPOSALS', title: 'PAGE_TITLE.PRACTICE_PROPOSALS' },
    loadComponent: () => import('./practice-proposals.component').then((m) => m.PracticeProposalsComponent),
  },
  {
    path: 'conflicts',
    data: { breadcrumb: 'NAV.PRACTICE_CONFLICTS', title: 'PAGE_TITLE.PRACTICE_CONFLICTS' },
    loadComponent: () => import('./practice-conflicts.component').then((m) => m.PracticeConflictsComponent),
  },
  {
    path: 'expenses',
    data: { breadcrumb: 'NAV.PRACTICE_EXPENSES', title: 'PAGE_TITLE.PRACTICE_EXPENSES' },
    loadComponent: () => import('./practice-expenses.component').then((m) => m.PracticeExpensesComponent),
  },
  {
    path: 'trust',
    data: { breadcrumb: 'NAV.PRACTICE_TRUST', title: 'PAGE_TITLE.PRACTICE_TRUST' },
    loadComponent: () => import('./practice-trust.component').then((m) => m.PracticeTrustComponent),
  },
];
