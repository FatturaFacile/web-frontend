import { Routes } from '@angular/router';
import { moduleGuard, platformAdminGuard } from '@core';
import { ResourcePageComponent } from '@shared';
import { PRIVACY_COMPLIANCE_PAGE } from './pages/privacy/privacy-compliance.page';
import { SDI_CHANNEL_PAGE } from './pages/sdi-channel/sdi-channel.page';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tenant',
  },
  {
    path: 'tenant',
    data: { breadcrumb: 'BREADCRUMB.IMPOSTAZIONI_AND_TENANT', title: 'PAGE_TITLE.IMPOSTAZIONI_TENANT' },
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
    path: 'security/enterprise',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'ENT_AUTH.TITLE', titleKey: 'ENT_AUTH.TITLE' },
    loadComponent: () =>
      import('./pages/enterprise-security/enterprise-security.component').then(
        (m) => m.EnterpriseSecurityComponent
      ),
  },
  {
    path: 'notifications',
    data: { breadcrumb: 'PLATFORM.NOTIFICATION_PREFERENCES', titleKey: 'PLATFORM.NOTIFICATION_PREFERENCES' },
    loadComponent: () =>
      import('./pages/notification-preferences/notification-preferences.component').then(
        (m) => m.NotificationPreferencesComponent
      ),
  },
  {
    path: 'recycle-bin',
    canActivate: [moduleGuard('platform', 'read')],
    data: { breadcrumb: 'PLATFORM.RECYCLE_BIN', titleKey: 'PLATFORM.RECYCLE_BIN' },
    loadComponent: () =>
      import('./pages/recycle-bin/recycle-bin.component').then((m) => m.RecycleBinComponent),
  },
  {
    path: 'sdi-channel',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'BREADCRUMB.CANALE_SDI', title: 'PAGE_TITLE.CANALE_DI_FATTURAZIONE_ELETTRONICA', page: SDI_CHANNEL_PAGE },
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
    path: 'users',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'memberAccess.title', title: 'memberAccess.title' },
    loadComponent: () => import('./pages/users/users.component').then((m) => m.TenantUsersComponent),
  },
  {
    path: 'admin/user-tenants',
    canActivate: [platformAdminGuard],
    data: { breadcrumb: 'userTenants.title', title: 'userTenants.title' },
    loadComponent: () =>
      import('./pages/users/user-tenants.component').then((m) => m.UserTenantsComponent),
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
    path: 'privacy/compliance',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'RES.PAGE.PRIVACY_COMPLIANCE', title: 'RES.PAGE.PRIVACY_COMPLIANCE', page: PRIVACY_COMPLIANCE_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'privacy',
    data: { breadcrumb: 'BREADCRUMB.PRIVACY_GDPR_NLPD', title: 'PAGE_TITLE.PRIVACY_CENTER_GDPR_SWISS_NLPD' },
    loadComponent: () =>
      import('./pages/privacy/privacy-center.component').then(
        (m) => m.PrivacyCenterComponent
      ),
  },
];
