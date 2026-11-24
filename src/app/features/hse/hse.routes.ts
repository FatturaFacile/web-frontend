import { Routes } from '@angular/router';

export const HSE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'compliance-matrix' },
  {
    path: 'compliance-matrix',
    data: { breadcrumb: 'HSE.NAV_MATRIX', title: 'HSE.MATRIX_TITLE' },
    loadComponent: () =>
      import('./hse-compliance-matrix.component').then((m) => m.HseComplianceMatrixComponent),
  },
  {
    path: 'requirements',
    data: { breadcrumb: 'HSE.NAV_REQUIREMENTS', title: 'HSE.REQ_TITLE' },
    loadComponent: () =>
      import('./hse-requirements-page.component').then((m) => m.HseRequirementsPageComponent),
  },
  {
    path: 'incidents',
    data: { breadcrumb: 'HSE.NAV_INCIDENTS', title: 'HSE.INC_TITLE' },
    loadComponent: () =>
      import('./hse-incidents-page.component').then((m) => m.HseIncidentsPageComponent),
  },
  {
    path: 'audits',
    data: { breadcrumb: 'HSE.NAV_AUDITS', title: 'HSE.AUDIT_TITLE' },
    loadComponent: () =>
      import('./hse-audits-page.component').then((m) => m.HseAuditsPageComponent),
  },
];
