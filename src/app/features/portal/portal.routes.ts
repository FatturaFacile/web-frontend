import { Routes } from '@angular/router';

export const PORTAL_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
  {
    path: 'family',
    data: { breadcrumb: 'FAMILY_PORTAL.TITLE' },
    loadComponent: () => import('./family/family-portal.component').then((m) => m.FamilyPortalComponent),
  },
  {
    path: 'payslips/:token',
    data: { breadcrumb: 'PAYSLIP_LINK.TITLE' },
    loadComponent: () => import('./payslip/payslip-link.component').then((m) => m.PayslipLinkComponent),
  },
  {
    path: ':token',
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
];
