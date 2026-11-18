import { Routes } from '@angular/router';
import { portalAuthGuard } from './area/portal-auth.guard';

export const PORTAL_ROUTES: Routes = [
  // Self-service customer area (white-label, passwordless): rendered without the back-office shell.
  {
    path: 'login',
    data: { publicPage: true, title: 'PORTAL_AREA.LOGIN_TITLE' },
    loadComponent: () =>
      import('./area/portal-login.component').then((m) => m.PortalLoginComponent),
  },
  {
    path: 'auth/verify',
    data: { publicPage: true, title: 'PORTAL_AREA.LOGIN_TITLE' },
    loadComponent: () =>
      import('./area/portal-verify.component').then((m) => m.PortalVerifyComponent),
  },
  {
    path: '',
    canActivate: [portalAuthGuard],
    data: { publicPage: true, title: 'PORTAL_AREA.TITLE' },
    loadComponent: () =>
      import('./area/portal-shell.component').then((m) => m.PortalShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./area/portal-dashboard.component').then((m) => m.PortalDashboardComponent),
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('./area/portal-documents.component').then((m) => m.PortalDocumentsComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./area/portal-support.component').then((m) => m.PortalSupportComponent),
      },
    ],
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
  {
    path: 'family',
    data: { breadcrumb: 'FAMILY_PORTAL.TITLE' },
    loadComponent: () =>
      import('./family/family-portal.component').then((m) => m.FamilyPortalComponent),
  },
  {
    path: 'payslips/:token',
    data: { breadcrumb: 'PAYSLIP_LINK.TITLE' },
    loadComponent: () =>
      import('./payslip/payslip-link.component').then((m) => m.PayslipLinkComponent),
  },
  {
    path: ':token',
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
];
