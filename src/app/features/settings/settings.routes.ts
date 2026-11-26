import { Routes } from '@angular/router';
import { moduleGuard, permissionKeyGuard, platformAdminGuard } from '@core';
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
    path: 'roles',
    canMatch: [permissionKeyGuard('settings.roles.view')],
    data: { breadcrumb: 'IAM.ROLES_TITLE', titleKey: 'IAM.ROLES_TITLE' },
    loadComponent: () => import('./pages/roles/roles-list.component').then((m) => m.RolesListComponent),
  },
  {
    path: 'roles/:id',
    canMatch: [permissionKeyGuard('settings.roles.view')],
    data: { breadcrumb: 'IAM.ROLES_TITLE', titleKey: 'IAM.ROLES_TITLE' },
    loadComponent: () => import('./pages/roles/role-detail.component').then((m) => m.RoleDetailComponent),
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
    path: 'sdi',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'NAV.SDI_SETTINGS', title: 'NAV.SDI_SETTINGS' },
    loadComponent: () => import('../sdi-cockpit/sdi-settings.component').then((m) => m.SdiSettingsComponent),
  },
  {
    path: 'sdi-channel',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'BREADCRUMB.CANALE_SDI', title: 'PAGE_TITLE.CANALE_DI_FATTURAZIONE_ELETTRONICA', page: SDI_CHANNEL_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
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
    path: 'users/import',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'access.import.title', title: 'access.import.title' },
    loadComponent: () => import('./pages/users/users-import.component').then((m) => m.UsersImportComponent),
  },
  {
    path: 'access/invitations',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'access.invitations.title', title: 'access.invitations.title' },
    loadComponent: () => import('./pages/access/invitations.component').then((m) => m.AccessInvitationsComponent),
  },
  {
    path: 'access/roles',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'access.roles.title', title: 'access.roles.title' },
    loadComponent: () => import('./pages/access/roles.component').then((m) => m.AccessRolesComponent),
  },
  {
    path: 'access/teams',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'access.teams.title', title: 'access.teams.title' },
    loadComponent: () => import('./pages/access/teams.component').then((m) => m.AccessTeamsComponent),
  },
  {
    path: 'access/delegations',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'access.delegations.title', title: 'access.delegations.title' },
    loadComponent: () => import('./pages/access/delegations.component').then((m) => m.AccessDelegationsComponent),
  },
  {
    path: 'access/matrix',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'access.matrix.title', title: 'access.matrix.title' },
    loadComponent: () => import('./pages/access/matrix.component').then((m) => m.AccessMatrixComponent),
  },
  {
    path: 'audit',
    canActivate: [moduleGuard('audit_trail', 'read')],
    data: { breadcrumb: 'settings.audit.title', titleKey: 'settings.audit.title' },
    loadComponent: () =>
      import('./pages/audit/audit-log-page.component').then((m) => m.AuditLogPageComponent),
  },
  {
    path: 'access/audit',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'access.audit.title', title: 'access.audit.title' },
    loadComponent: () => import('./pages/access/audit.component').then((m) => m.AccessAuditComponent),
  },
  {
    path: 'admin/user-tenants',
    canActivate: [platformAdminGuard],
    data: { breadcrumb: 'userTenants.title', title: 'userTenants.title' },
    loadComponent: () =>
      import('./pages/users/user-tenants.component').then((m) => m.UserTenantsComponent),
  },
  {
    path: 'admin/tenant-plan',
    canActivate: [platformAdminGuard],
    data: { breadcrumb: 'tenantPlan.title', title: 'tenantPlan.title' },
    loadComponent: () => import('./pages/users/tenant-plan.component').then((m) => m.TenantPlanComponent),
  },
  {
    path: 'admin/access-requests',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'NAV.ADMIN_ACCESS_REQUESTS', title: 'NAV.ADMIN_ACCESS_REQUESTS' },
    loadComponent: () =>
      import('./pages/access-requests/access-requests.component').then((m) => m.AccessRequestsComponent),
  },
  {
    path: 'webhooks',
    canActivate: [moduleGuard('integrations', 'read')],
    data: { breadcrumb: 'WEBHOOKS.TITLE', title: 'WEBHOOKS.TITLE' },
    loadComponent: () => import('./pages/webhooks/webhooks.component').then((m) => m.WebhooksComponent),
  },
  {
    path: 'ai',
    canActivate: [moduleGuard('ai_admin', 'read')],
    data: { breadcrumb: 'AI_COG.SETTINGS_TITLE', title: 'AI_COG.SETTINGS_TITLE' },
    loadComponent: () =>
      import('../ai-cognitive/ai-settings-page.component').then((m) => m.AiSettingsPageComponent),
  },
  {
    path: 'tags',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'COLLABORATION.TAGS.TITLE', title: 'COLLABORATION.TAGS.TITLE' },
    loadComponent: () => import('./pages/tags/tags.component').then((m) => m.CollaborationTagsComponent),
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
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'privacy',
    data: { breadcrumb: 'BREADCRUMB.PRIVACY_GDPR_NLPD', title: 'PAGE_TITLE.PRIVACY_CENTER_GDPR_SWISS_NLPD' },
    loadComponent: () =>
      import('./pages/privacy/privacy-center.component').then(
        (m) => m.PrivacyCenterComponent
      ),
  },
  {
    path: 'corporate-group',
    canActivate: [moduleGuard('system', 'read')],
    data: { breadcrumb: 'CORPORATE_GROUP.TITLE', title: 'CORPORATE_GROUP.TITLE' },
    loadComponent: () =>
      import('./pages/corporate-group/corporate-group.component').then(
        (m) => m.CorporateGroupComponent
      ),
  },
];
