import { Routes } from '@angular/router';
import { moduleGuard } from '@core';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tenant',
  },
  {
    path: 'tenant',
    data: { breadcrumb: 'Impostazioni & Tenant', title: 'Impostazioni Tenant' },
    loadComponent: () =>
      import('./settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'security',
    data: { breadcrumb: 'Sicurezza & Sessioni', title: 'Sicurezza Utente & Sessioni' },
    loadComponent: () =>
      import('./pages/security/security-settings.component').then(
        (m) => m.SecuritySettingsComponent
      ),
  },
  {
    path: 'security/two-factor',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'Policy 2FA', title: 'Policy Sicurezza 2FA Aziendale' },
    loadComponent: () =>
      import('./pages/tenant-security/tenant-security-policy.component').then(
        (m) => m.TenantSecurityPolicyComponent
      ),
  },
  {
    path: 'privacy',
    data: { breadcrumb: 'Privacy (GDPR / nLPD)', title: 'Privacy Center (GDPR & Swiss nLPD)' },
    loadComponent: () =>
      import('./pages/privacy/privacy-center.component').then(
        (m) => m.PrivacyCenterComponent
      ),
  },
];
