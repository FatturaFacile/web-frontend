import { Routes } from '@angular/router';
import { moduleGuard } from '@core';

/** Privacy & Data Governance Suite (Mod 096): owners and admins ('system' module), like the other settings pages. */
export const PRIVACY_GOVERNANCE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'PRIVACY.NAV.DASHBOARD', title: 'PRIVACY.NAV.DASHBOARD' },
    loadComponent: () =>
      import('./privacy-dashboard.component').then((m) => m.PrivacyDashboardComponent),
  },
  {
    path: 'ropa',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'PRIVACY.NAV.ROPA', title: 'PRIVACY.NAV.ROPA' },
    loadComponent: () => import('./ropa-registry.component').then((m) => m.RopaRegistryComponent),
  },
  {
    path: 'dsar',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'PRIVACY.NAV.DSAR', title: 'PRIVACY.NAV.DSAR' },
    loadComponent: () => import('./dsar-workbench.component').then((m) => m.DsarWorkbenchComponent),
  },
  {
    path: 'breaches',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'PRIVACY.NAV.BREACHES', title: 'PRIVACY.NAV.BREACHES' },
    loadComponent: () =>
      import('./data-breach-assistant.component').then((m) => m.DataBreachAssistantComponent),
  },
  {
    path: 'consent-retention',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'PRIVACY.NAV.CONSENT_RETENTION', title: 'PRIVACY.NAV.CONSENT_RETENTION' },
    loadComponent: () =>
      import('./consent-and-retention.component').then((m) => m.ConsentAndRetentionComponent),
  },
];
