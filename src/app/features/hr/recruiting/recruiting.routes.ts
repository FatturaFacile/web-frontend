import { Routes } from '@angular/router';

export const RECRUITING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'openings',
  },
  {
    path: 'openings',
    data: { breadcrumb: 'hr.recruiting.breadcrumb.openings' },
    loadComponent: () =>
      import('./job-openings/job-openings.component').then((m) => m.JobOpeningsComponent),
  },
  {
    path: 'openings/:id/board',
    loadComponent: () =>
      import('./board/recruiting-board.component').then((m) => m.RecruitingBoardComponent),
  },
  {
    path: 'candidates/:id',
    loadComponent: () =>
      import('./candidate/candidate-detail.component').then((m) => m.CandidateDetailComponent),
  },
  {
    path: 'settings',
    data: { breadcrumb: 'hr.recruiting.breadcrumb.settings' },
    loadComponent: () =>
      import('./settings/recruiting-settings.component').then((m) => m.RecruitingSettingsComponent),
  },
];
