import { Routes } from '@angular/router';
import { moduleGuard } from '@core';
import { ResourcePageComponent } from '@shared';
import { SDI_CHANNEL_PAGE } from './pages/sdi-channel/sdi-channel.page';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tenant',
  },
  {
    path: 'tenant',
    data: { breadcrumb: 'BREADCRUMB.IMPOSTAZIONI_AND_TENANT', title: 'Impostazioni Tenant' },
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
    path: 'sdi-channel',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'BREADCRUMB.CANALE_SDI', title: 'Canale di fatturazione elettronica', page: SDI_CHANNEL_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'document-templates',
    canActivate: [moduleGuard('integrations', 'read')],
    data: { breadcrumb: 'DOCUMENT_TEMPLATES.TITLE', titleKey: 'DOCUMENT_TEMPLATES.TITLE' },
    loadComponent: () =>
      import('./pages/document-templates/document-templates.component').then(
        (m) => m.DocumentTemplatesComponent
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
    data: { breadcrumb: 'BREADCRUMB.PRIVACY_GDPR_NLPD', title: 'Privacy Center (GDPR & Swiss nLPD)' },
    loadComponent: () =>
      import('./pages/privacy/privacy-center.component').then(
        (m) => m.PrivacyCenterComponent
      ),
  },
];
