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
    path: 'profile',
    data: { breadcrumb: 'PROFILE.TITLE', titleKey: 'PROFILE.TITLE' },
    loadComponent: () =>
      import('./pages/profile/profile-settings.component').then((m) => m.ProfileSettingsComponent),
  },
  {
    path: 'security',
    data: { breadcrumb: 'SECURITY.TITLE', titleKey: 'SECURITY.TITLE' },
    loadComponent: () =>
      import('./pages/security/security-settings.component').then(
        (m) => m.SecuritySettingsComponent
      ),
  },
  {
    path: 'security/two-factor',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'TENANT_SECURITY.BREADCRUMB', titleKey: 'TENANT_SECURITY.TITLE' },
    loadComponent: () =>
      import('./pages/tenant-security/tenant-security-policy.component').then(
        (m) => m.TenantSecurityPolicyComponent
      ),
  },
  {
    path: 'admin/access-requests',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'NAV.ADMIN_ACCESS_REQUESTS', title: 'NAV.ADMIN_ACCESS_REQUESTS' },
    loadComponent: () =>
      import('./pages/access-requests/access-requests.component').then((m) => m.AccessRequestsComponent),
  },
  {
    path: 'lookups',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'NAV.LOOKUP_TRANSLATIONS', title: 'NAV.LOOKUP_TRANSLATIONS' },
    loadComponent: () =>
      import('./pages/lookup-translations/lookup-translations.component').then((m) => m.LookupTranslationsComponent),
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
