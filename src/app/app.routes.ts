import { Routes } from '@angular/router';
import { authGuard, guestGuard, moduleGuard, roleGuard } from '@core/auth/auth.guard';
import { SECURITY_CENTER_ROLES } from './features/security/security-center/security-center.model';
import { menuEnabledGuard } from '@core/auth/menu-enabled.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'auth/login',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'pages/auth/login',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'pages/auth/register',
    pathMatch: 'full',
    redirectTo: 'register',
  },
  {
    path: 'pages/auth/forgot-password',
    pathMatch: 'full',
    redirectTo: 'forgot-password',
  },
  {
    path: 'pages/auth/reset-password',
    pathMatch: 'full',
    redirectTo: 'reset-password',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.ACCEDI_A_FATTURA_FACILE' },
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Must match `auth.sso_exchange.frontend_path` of the API (`/auth/sso/complete`).
    path: 'auth/sso/complete',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.ACCESSO_SSO' },
    loadComponent: () =>
      import('./features/auth/pages/sso-complete/sso-complete.component').then(
        (m) => m.SsoCompleteComponent,
      ),
  },
  {
    path: 'register',
    pathMatch: 'full',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.REGISTRATI_A_FATTURA_FACILE' },
    loadComponent: () =>
      import('./features/auth/pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'register/check-email',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.CONTROLLA_LA_TUA_EMAIL' },
    loadComponent: () =>
      import('./features/auth/pages/check-email/check-email.component').then(
        (m) => m.CheckEmailComponent,
      ),
  },
  {
    path: 'verify-email',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.CONFERMA_EMAIL' },
    loadComponent: () =>
      import('./features/auth/pages/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent,
      ),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.PASSWORD_DIMENTICATA' },
    loadComponent: () =>
      import('./features/auth/pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.REIMPOSTA_PASSWORD' },
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    // Public: the person opening the link of an invitation email may have no account yet, or be signed in already.
    path: 'accept-invitation',
    data: { title: 'access.accept.title' },
    loadComponent: () =>
      import('./features/auth/pages/accept-invitation/accept-invitation.component').then(
        (m) => m.AcceptInvitationComponent,
      ),
  },
  {
    path: 'password-updated',
    canActivate: [guestGuard],
    data: { title: 'PAGE_TITLE.PASSWORD_AGGIORNATA' },
    loadComponent: () =>
      import('./features/auth/pages/password-updated/password-updated.component').then(
        (m) => m.PasswordUpdatedComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.DASHBOARD', title: 'PAGE_TITLE.DASHBOARD_ESECUTIVA' },
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'crm',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.CRM_AND_ANAGRAFICHE', title: 'PAGE_TITLE.CRM_CROSS_BORDER' },
    loadChildren: () => import('./features/crm/crm.routes').then((m) => m.CRM_ROUTES),
  },
  {
    path: 'sales',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.VENDITE_AND_FATTURAZIONE', title: 'PAGE_TITLE.VENDITE' },
    loadChildren: () => import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES),
  },
  {
    path: 'logistics',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.LOGISTICA_DDT', title: 'PAGE_TITLE.LOGISTICA' },
    loadChildren: () =>
      import('./features/logistics/logistics.routes').then((m) => m.LOGISTICS_ROUTES),
  },
  {
    path: 'purchases',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.ACQUISTI_AND_AP', title: 'PAGE_TITLE.ACQUISTI' },
    loadChildren: () =>
      import('./features/purchases/purchases.routes').then((m) => m.PURCHASES_ROUTES),
  },
  {
    // Public/deep-link email 1-click approve/reject handler (Mod 044): no authGuard, renders without app shell.
    path: 'procurement/requisitions/one-click',
    data: { publicPage: true, title: 'PR.ONE_CLICK.TITLE' },
    loadComponent: () =>
      import('./features/procurement/requisitions/pr-one-click-action.component').then(
        (m) => m.PrOneClickActionComponent,
      ),
  },
  {
    path: 'procurement',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.APPROVVIGIONAMENTO', title: 'PAGE_TITLE.APPROVVIGIONAMENTO' },
    loadChildren: () =>
      import('./features/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES),
  },
  {
    path: 'treasury',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.TESORERIA_AND_BANCHE', title: 'PAGE_TITLE.TESORERIA' },
    loadChildren: () =>
      import('./features/treasury/treasury.routes').then((m) => m.TREASURY_ROUTES),
  },
  {
    path: 'inventory',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.MAGAZZINO_AND_LOGISTICA', title: 'PAGE_TITLE.MAGAZZINO' },
    loadChildren: () =>
      import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
  },
  {
    path: 'customs',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.DOGANA_IT_CH', title: 'PAGE_TITLE.DOGANA_SPEDIZIONI_IT_CH' },
    loadChildren: () => import('./features/customs/customs.routes').then((m) => m.CUSTOMS_ROUTES),
  },
  {
    path: 'workflows',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.PROCESSI_AND_APPROVAZIONI',
      title: 'PAGE_TITLE.WORKFLOW_APPROVAZIONI',
    },
    loadChildren: () =>
      import('./features/workflows/workflows.routes').then((m) => m.WORKFLOW_ROUTES),
  },
  {
    path: 'dms',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.GESTIONE_DOCUMENTALE_DMS', title: 'PAGE_TITLE.DMS_ARCHIVIO' },
    loadChildren: () => import('./features/dms/dms.routes').then((m) => m.DMS_ROUTES),
  },
  {
    path: 'contract-register',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.REGISTRO_CONTRATTI',
      title: 'PAGE_TITLE.REGISTRO_CONTRATTI_OBBLIGAZIONI',
    },
    loadChildren: () =>
      import('./features/contract-register/contract-register.routes').then(
        (m) => m.CONTRACT_REGISTER_ROUTES,
      ),
  },
  {
    path: 'associations/governance',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.GOVERNANCE_E_CONFORMITA',
      title: 'PAGE_TITLE.GOVERNANCE_E_CONFORMITA_DELLE_ASSOCIAZIONI',
    },
    loadChildren: () =>
      import('./features/associations/governance/governance.routes').then(
        (m) => m.ASSOCIATIONS_GOVERNANCE_ROUTES,
      ),
  },
  {
    path: 'associations',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.ASSOCIAZIONI_AND_TERZO_SETTORE',
      title: 'PAGE_TITLE.ASSOCIAZIONI_ETS_SPORTIVE',
    },
    loadChildren: () =>
      import('./features/associations/associations.routes').then((m) => m.ASSOCIATIONS_ROUTES),
  },
  {
    path: 'childcare',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.INFANZIA_AND_ASILO_NIDO',
      title: 'PAGE_TITLE.INFANZIA_ASILO_NIDO',
    },
    loadChildren: () =>
      import('./features/childcare/childcare.routes').then((m) => m.CHILDCARE_ROUTES),
  },
  {
    path: 'contract-signing/:token',
    data: { title: 'CONTRACT_SIGN.TITLE' },
    loadComponent: () =>
      import('./features/contract-signing/contract-signing.component').then(
        (m) => m.ContractSigningComponent,
      ),
  },
  {
    path: 'quote-signature/:token',
    data: { title: 'CPQ.SIGN.TITLE' },
    loadComponent: () =>
      import('./features/quote-signature/quote-signature.component').then(
        (m) => m.QuoteSignatureComponent,
      ),
  },
  {
    path: 'portal',
    data: { breadcrumb: 'NAV.PORTAL', title: 'PAGE_TITLE.AREA_CLIENTI_PORTALE_B2B' },
    loadChildren: () => import('./features/portal/portal.routes').then((m) => m.PORTAL_ROUTES),
  },
  {
    path: 'intrastat',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.INTRASTAT', title: 'PAGE_TITLE.ELENCHI_INTRASTAT_UE' },
    loadChildren: () =>
      import('./features/intrastat/intrastat.routes').then((m) => m.INTRASTAT_ROUTES),
  },
  {
    path: 'document-trust',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.DOCUMENT_TRUST', title: 'PAGE_TITLE.RETI_E_DOCUMENT_DIGITAL_TRUST' },
    loadChildren: () =>
      import('./features/document-trust/document-trust.routes').then(
        (m) => m.DOCUMENT_TRUST_ROUTES,
      ),
  },
  {
    path: 'ocr-inbox',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'OCR_INBOX.TITLE', title: 'OCR_INBOX.TITLE' },
    loadChildren: () =>
      import('./features/ocr-inbox/ocr-inbox.routes').then((m) => m.OCR_INBOX_ROUTES),
  },
  {
    path: 'data-sovereignty',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'DATA_SOVEREIGNTY.TITLE', title: 'DATA_SOVEREIGNTY.TITLE' },
    loadChildren: () =>
      import('./features/data-sovereignty/data-sovereignty.routes').then(
        (m) => m.DATA_SOVEREIGNTY_ROUTES,
      ),
  },
  {
    path: 'ocr-inbox',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'OCR_INBOX.TITLE', title: 'OCR_INBOX.TITLE' },
    loadChildren: () =>
      import('./features/ocr-inbox/ocr-inbox.routes').then((m) => m.OCR_INBOX_ROUTES),
  },
  {
    path: 'kpi-dashboards',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'KPI_DASHBOARDS.TITLE', title: 'KPI_DASHBOARDS.TITLE' },
    loadChildren: () =>
      import('./features/kpi-dashboards/kpi-dashboards.routes').then((m) => m.KPI_DASHBOARDS_ROUTES),
  },
  {
    path: 'cpq-quotes',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'CPQ_QUOTES.TITLE', title: 'CPQ_QUOTES.TITLE' },
    loadChildren: () =>
      import('./features/cpq-quotes/cpq-quotes.routes').then((m) => m.CPQ_QUOTES_ROUTES),
  },
  {
    path: 'ai',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'AI_COG.TITLE', title: 'AI_COG.TITLE' },
    loadChildren: () =>
      import('./features/ai-cognitive/ai-cognitive.routes').then((m) => m.AI_COGNITIVE_ROUTES),
  },
  {
    path: 'ocr-inbox',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'OCR_INBOX.TITLE', title: 'OCR_INBOX.TITLE' },
    loadChildren: () =>
      import('./features/ocr-inbox/ocr-inbox.routes').then((m) => m.OCR_INBOX_ROUTES),
  },
  {
    path: 'hse',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'HSE.NAV', title: 'HSE.NAV' },
    loadChildren: () => import('./features/hse/hse.routes').then((m) => m.HSE_ROUTES),
  },
  {
    path: 'ai-forecasting',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'AI_FORECAST.TITLE', title: 'AI_FORECAST.TITLE' },
    loadChildren: () =>
      import('./features/ai-forecasting/ai-forecasting.routes').then(
        (m) => m.AI_FORECASTING_ROUTES,
      ),
  },
  {
    path: 'digital-preservation',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'PRESERVATION.TITLE', title: 'PRESERVATION.TITLE' },
    loadChildren: () =>
      import('./features/digital-preservation/digital-preservation.routes').then(
        (m) => m.DIGITAL_PRESERVATION_ROUTES,
      ),
  },
  {
    path: 'academy',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'ACADEMY.TITLE', title: 'ACADEMY.TITLE' },
    loadChildren: () => import('./features/academy/academy.routes').then((m) => m.ACADEMY_ROUTES),
  },
  {
    path: 'ecommerce-integrations',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'NAV.ECOMMERCE_INTEGRATIONS',
      title: 'PAGE_TITLE.E_COMMERCE_INTEGRAZIONI_API',
    },
    loadChildren: () =>
      import('./features/ecommerce-integrations/ecommerce-integrations.routes').then(
        (m) => m.ECOMMERCE_INTEGRATIONS_ROUTES,
      ),
  },
  {
    path: 'tessera-sanitaria',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'NAV.TESSERA_SANITARIA',
      title: 'PAGE_TITLE.SISTEMA_TESSERA_SANITARIA_STS',
    },
    loadChildren: () =>
      import('./features/tessera-sanitaria/tessera-sanitaria.routes').then(
        (m) => m.TESSERA_SANITARIA_ROUTES,
      ),
  },
  {
    path: 'visitors',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.VISITORS', title: 'PAGE_TITLE.VISITATORI_KIOSK_RECEPTION' },
    loadChildren: () =>
      import('./features/visitors/visitors.routes').then((m) => m.VISITORS_ROUTES),
  },
  {
    path: 'facility',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.FACILITY', title: 'PAGE_TITLE.FACILITY' },
    loadChildren: () =>
      import('./features/facility/facility.routes').then((m) => m.FACILITY_ROUTES),
  },
  {
    path: 'supplier-portal',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.SUPPLIER_PORTAL', title: 'SUPPLIER_PORTAL.TITLE' },
    loadChildren: () =>
      import('./features/supplier-portal/supplier-portal.routes').then(
        (m) => m.SUPPLIER_PORTAL_ROUTES,
      ),
  },
  {
    path: 'travel',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.TRAVEL', title: 'PAGE_TITLE.VIAGGI_E_TRASFERTE' },
    loadChildren: () => import('./features/travel/travel.routes').then((m) => m.TRAVEL_ROUTES),
  },
  {
    path: 'configurator',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.CONFIGURATOR', title: 'PAGE_TITLE.CONFIGURATORE_PRODOTTI' },
    loadChildren: () =>
      import('./features/configurator/configurator.routes').then((m) => m.CONFIGURATOR_ROUTES),
  },
  {
    path: 'privacy-governance',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'PRIVACY.NAV.TITLE', title: 'PRIVACY.NAV.TITLE' },
    loadChildren: () =>
      import('./features/privacy-governance/privacy-governance.routes').then(
        (m) => m.PRIVACY_GOVERNANCE_ROUTES,
      ),
  },
  {
    path: 'governance',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.GOVERNANCE', title: 'PAGE_TITLE.GOVERNANCE_RISK_COMPLIANCE' },
    loadChildren: () =>
      import('./features/governance/governance.routes').then((m) => m.GOVERNANCE_ROUTES),
  },
  {
    path: 'leases',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.LEASES', title: 'PAGE_TITLE.LEASES' },
    loadChildren: () =>
      import('./features/lease-accounting/lease-accounting.routes').then(
        (m) => m.LEASE_ACCOUNTING_ROUTES,
      ),
  },
  {
    path: 'sustainability',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.SUSTAINABILITY', title: 'PAGE_TITLE.SUSTAINABILITY_ESG' },
    loadChildren: () =>
      import('./features/sustainability/sustainability.routes').then(
        (m) => m.SUSTAINABILITY_ROUTES,
      ),
  },
  {
    path: 'returns',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.RETURNS', title: 'PAGE_TITLE.RETURNS_DASHBOARD' },
    loadChildren: () => import('./features/returns/returns.routes').then((m) => m.RETURNS_ROUTES),
  },
  {
    path: 'credit-management',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.CREDIT_MANAGEMENT', title: 'PAGE_TITLE.CREDIT_MANAGEMENT' },
    loadChildren: () =>
      import('./features/credit-management/credit-management.routes').then(
        (m) => m.CREDIT_MANAGEMENT_ROUTES,
      ),
  },
  {
    path: 'analytics',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.ANALYTICS', title: 'NAV.ANALYTICS' },
    loadChildren: () =>
      import('./features/analytics/analytics.routes').then((m) => m.ANALYTICS_ROUTES),
  },
  {
    path: 'business-intelligence',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.BI', title: 'PAGE_TITLE.BI' },
    loadChildren: () =>
      import('./features/business-intelligence/business-intelligence.routes').then(
        (m) => m.BUSINESS_INTELLIGENCE_ROUTES,
      ),
  },
  {
    path: 'shift-planning',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.SHIFT_PLANNING', title: 'PAGE_TITLE.SHIFT_PLANNING' },
    loadChildren: () => import('./features/shift-planning/shift-planning.routes').then((m) => m.SHIFT_PLANNING_ROUTES),
  },
  {
    path: 'marketplace',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.MARKETPLACE', title: 'PAGE_TITLE.MARKETPLACE' },
    loadChildren: () =>
      import('./features/marketplace/marketplace.routes').then((m) => m.MARKETPLACE_ROUTES),
  },
  {
    path: 'events',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.EVENTS_MANAGEMENT', title: 'PAGE_TITLE.EVENTS' },
    loadChildren: () => import('./features/events/events.routes').then((m) => m.EVENTS_ROUTES),
  },
  {
    path: 'plm',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.PLM_MANAGEMENT', title: 'PAGE_TITLE.PLM' },
    loadChildren: () => import('./features/plm/plm.routes').then((m) => m.PLM_ROUTES),
  },
  {
    path: 'pricing',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.PRICING_MANAGEMENT', title: 'PAGE_TITLE.PRICING' },
    loadChildren: () => import('./features/pricing/pricing.routes').then((m) => m.PRICING_ROUTES),
  },
  {
    path: 'rebates',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.REBATES_MANAGEMENT', title: 'PAGE_TITLE.REBATES' },
    loadChildren: () => import('./features/rebates/rebates.routes').then((m) => m.REBATES_ROUTES),
  },
  {
    path: 'fleet',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.FLEET_MANAGEMENT', title: 'PAGE_TITLE.FLEET' },
    loadChildren: () => import('./features/fleet/fleet.routes').then((m) => m.FLEET_ROUTES),
  },
  {
    path: 'wms',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.WMS', title: 'PAGE_TITLE.WMS' },
    loadChildren: () => import('./features/wms/wms.routes').then((m) => m.WMS_ROUTES),
  },
  {
    path: 'transportation',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.TMS', title: 'PAGE_TITLE.TMS' },
    loadChildren: () =>
      import('./features/transportation/transportation.routes').then(
        (m) => m.TRANSPORTATION_ROUTES,
      ),
  },
  {
    path: 'quality',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.QUALITY_MANAGEMENT', title: 'PAGE_TITLE.QUALITY_SPC' },
    loadChildren: () => import('./features/quality/quality.routes').then((m) => m.QUALITY_ROUTES),
  },
  {
    path: 'planning',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.PLANNING', title: 'PAGE_TITLE.PLANNING' },
    loadChildren: () =>
      import('./features/planning/planning.routes').then((m) => m.PLANNING_ROUTES),
  },
  {
    path: 'security/audit-trail',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.AUDIT_TRAIL', title: 'PAGE_TITLE.AUDIT_TRAIL' },
    loadChildren: () =>
      import('./features/security/audit-trail/audit-trail.routes').then(
        (m) => m.AUDIT_TRAIL_ROUTES,
      ),
  },
  {
    path: 'security-center',
    canActivate: [authGuard, menuEnabledGuard, roleGuard([...SECURITY_CENTER_ROLES])],
    data: { breadcrumb: 'SECURITY_CENTER.TITLE', title: 'SECURITY_CENTER.TITLE' },
    loadChildren: () =>
      import('./features/security/security-center/security-center.routes').then((m) => m.SECURITY_CENTER_ROUTES),
  },
  {
    path: 'controlling',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.CONTROLLING', title: 'PAGE_TITLE.CONTROLLING' },
    loadChildren: () =>
      import('./features/controlling/controlling.routes').then((m) => m.CONTROLLING_ROUTES),
  },
  {
    path: 'budgeting',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.BUDGETING', title: 'PAGE_TITLE.BUDGETING' },
    loadChildren: () =>
      import('./features/budgeting/budgeting.routes').then((m) => m.BUDGETING_ROUTES),
  },
  {
    path: 'talent-learning',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.TALENT_LEARNING', title: 'PAGE_TITLE.TALENT_LEARNING' },
    loadChildren: () =>
      import('./features/talent-learning/talent-learning.routes').then(
        (m) => m.TALENT_LEARNING_ROUTES,
      ),
  },
  {
    path: 'communication',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.COMMUNICATION', title: 'PAGE_TITLE.COMUNICAZIONI_MULTI_CANALE' },
    loadChildren: () =>
      import('./features/communication/communication.routes').then((m) => m.COMMUNICATION_ROUTES),
  },
  {
    path: 'appointments',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.AGENDA_AND_APPUNTAMENTI',
      title: 'PAGE_TITLE.APPUNTAMENTI_CALENDARIO',
    },
    loadChildren: () =>
      import('./features/appointments/appointments.routes').then((m) => m.APPOINTMENTS_ROUTES),
  },
  {
    path: 'field-service',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.ASSISTENZA_AND_INTERVENTI', title: 'PAGE_TITLE.ASSISTENZA' },
    loadChildren: () =>
      import('./features/field-service/field-service.routes').then((m) => m.FIELD_SERVICE_ROUTES),
  },
  {
    path: 'helpdesk',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.HELPDESK_AND_ITSM', title: 'PAGE_TITLE.HELPDESK' },
    loadChildren: () =>
      import('./features/helpdesk/helpdesk.routes').then((m) => m.HELPDESK_ROUTES),
  },
  {
    path: 'projects',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.PROGETTI_AND_COMMESSE', title: 'PAGE_TITLE.PROGETTI' },
    loadChildren: () =>
      import('./features/projects/projects.routes').then((m) => m.PROJECTS_ROUTES),
  },
  {
    path: 'assets',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.CESPITI_AND_ASSET_EAM', title: 'PAGE_TITLE.CESPITI' },
    loadChildren: () => import('./features/assets/assets.routes').then((m) => m.ASSETS_ROUTES),
  },
  {
    path: 'catalog',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.ANAGRAFICHE_CATALOGO',
      title: 'PAGE_TITLE.ANAGRAFICHE_CATALOGO',
    },
    loadComponent: () =>
      import('./features/catalog/catalog-master-data.component').then(
        (m) => m.CatalogMasterDataComponent,
      ),
  },
  {
    path: 'subscriptions',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.ABBONAMENTI_AND_CONTRATTI_RECURRENTI',
      title: 'PAGE_TITLE.ABBONAMENTI',
    },
    loadChildren: () =>
      import('./features/subscriptions/subscriptions.routes').then((m) => m.SUBSCRIPTIONS_ROUTES),
  },
  {
    path: 'warranty-rma',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.WARRANTY_RMA', title: 'PAGE_TITLE.WARRANTY_RMA' },
    loadChildren: () =>
      import('./features/warranty-rma/warranty-rma.routes').then((m) => m.WARRANTY_RMA_ROUTES),
  },
  {
    path: 'automotive',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.AUTOMOTIVE_AND_GOMME', title: 'PAGE_TITLE.AUTOMOTIVE' },
    loadChildren: () =>
      import('./features/automotive/automotive.routes').then((m) => m.AUTOMOTIVE_ROUTES),
  },
  {
    path: 'rent',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.NOLEGGIO_FLOTTE', title: 'PAGE_TITLE.NOLEGGIO' },
    loadChildren: () => import('./features/rent/rent.routes').then((m) => m.RENT_ROUTES),
  },
  {
    path: 'construction',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.CANTIERI_AND_IMPIANTI', title: 'PAGE_TITLE.CANTIERI' },
    loadChildren: () =>
      import('./features/construction/construction.routes').then((m) => m.CONSTRUCTION_ROUTES),
  },
  {
    path: 'professionals',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.STUDI_PROFESSIONALI', title: 'PAGE_TITLE.STUDI_PROFESSIONALI' },
    loadChildren: () =>
      import('./features/professionals/professionals.routes').then((m) => m.PROFESSIONALS_ROUTES),
  },
  {
    path: 'manufacturing',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.PRODUZIONE_AND_MRP', title: 'PAGE_TITLE.PRODUZIONE' },
    loadChildren: () =>
      import('./features/manufacturing/manufacturing.routes').then((m) => m.MANUFACTURING_ROUTES),
  },
  {
    path: 'hospitality',
    canActivate: [authGuard, menuEnabledGuard],
    data: {
      breadcrumb: 'BREADCRUMB.RISTORAZIONE_AND_HOSPITALITY',
      title: 'PAGE_TITLE.HOSPITALITY_COMANDE',
    },
    loadChildren: () =>
      import('./features/hospitality/hospitality.routes').then((m) => m.HOSPITALITY_ROUTES),
  },
  {
    path: 'mobile',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'RES.PAGE.MOBILE_ADMIN', title: 'RES.PAGE.MOBILE_ADMIN' },
    loadChildren: () => import('./features/mobile/mobile.routes').then((m) => m.MOBILE_ROUTES),
  },
  {
    path: 'retail',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.VENDITA_AL_BANCO_AND_POS', title: 'POS' },
    loadChildren: () => import('./features/retail/retail.routes').then((m) => m.RETAIL_ROUTES),
  },
  {
    // The old clock screen called the deprecated /time-attendance/* endpoints: working time now lives in /hr/time.
    path: 'time-attendance',
    pathMatch: 'full',
    redirectTo: 'hr/time',
  },
  {
    path: 'hr',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.PAYROLL_AND_HR_IT_CH', title: 'PAGE_TITLE.HR_PAYROLL' },
    loadChildren: () => import('./features/hr/hr.routes').then((m) => m.HR_ROUTES),
  },
  {
    path: 'exports',
    canActivate: [authGuard, menuEnabledGuard, moduleGuard('exports', 'read')],
    data: { breadcrumb: 'NAV.EXPORTS', title: 'NAV.EXPORTS' },
    loadComponent: () =>
      import('./features/exports/exports.component').then((m) => m.ExportsComponent),
  },
  {
    path: 'sdi-cockpit',
    canActivate: [authGuard, menuEnabledGuard, moduleGuard('invoicing', 'read')],
    data: { breadcrumb: 'NAV.SDI_COCKPIT', title: 'NAV.SDI_COCKPIT' },
    loadComponent: () =>
      import('./features/sdi-cockpit/sdi-cockpit.component').then((m) => m.SdiCockpitComponent),
  },
  {
    path: 'sdi-transmissions',
    canActivate: [authGuard, menuEnabledGuard, moduleGuard('invoicing', 'read')],
    data: { breadcrumb: 'NAV.SDI_TRANSMISSIONS', title: 'NAV.SDI_TRANSMISSIONS' },
    loadComponent: () =>
      import('./features/sdi-transmissions/sdi-transmissions.component').then(
        (m) => m.SdiTransmissionsComponent,
      ),
  },
  {
    path: 'accounting',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.CONTABILITA_AND_FISCALE', title: 'PAGE_TITLE.CONTABILITA' },
    loadChildren: () =>
      import('./features/accounting/accounting.routes').then((m) => m.ACCOUNTING_ROUTES),
  },
  {
    path: 'general-ledger',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.GENERAL_LEDGER', title: 'NAV.GENERAL_LEDGER' },
    loadChildren: () =>
      import('./features/general-ledger/general-ledger.routes').then(
        (m) => m.GENERAL_LEDGER_ROUTES,
      ),
  },
  {
    path: 'alerts',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.CENTRO_AVVISI', title: 'PAGE_TITLE.CENTRO_AVVISI' },
    loadChildren: () => import('./features/alerts/alerts.routes').then((m) => m.ALERTS_ROUTES),
  },
  {
    path: 'system',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.SISTEMA_AND_BACKUP', title: 'PAGE_TITLE.SISTEMA' },
    loadChildren: () => import('./features/system/system.routes').then((m) => m.SYSTEM_ROUTES),
  },
  {
    path: 'workspace',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.WORKSPACE', title: 'NAV.WORKSPACE' },
    loadComponent: () =>
      import('./features/workspace/workspace.component').then((m) => m.WorkspaceComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.IMPOSTAZIONI_AND_TENANT', title: 'PAGE_TITLE.IMPOSTAZIONI' },
    loadChildren: () =>
      import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
  },
  {
    path: 'orders',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.STORICO_ORDINI', title: 'PAGE_TITLE.STORICO_ORDINI' },
    loadChildren: () => import('./features/order-history').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'welcome',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'BREADCRUMB.BENVENUTO', title: 'PAGE_TITLE.BENVENUTO' },
    loadChildren: () => import('./features/welcome').then((m) => m.WELCOME_ROUTES),
  },
  // Customer-facing RMA pages: no guard, rendered without the application shell (`data.publicPage`).
  {
    path: 'rma-estimate/:token',
    data: { publicPage: true, title: 'RMA.ESTIMATE.TITLE' },
    loadComponent: () =>
      import('./features/warranty-rma/public/rma-estimate.component').then(
        (m) => m.RmaEstimateComponent,
      ),
  },
  {
    path: 'supplier-bid/:token',
    data: { publicPage: true, title: 'RFQ.PORTAL.TITLE' },
    loadComponent: () =>
      import('./features/procurement/rfq/supplier-bid-portal.component').then(
        (m) => m.SupplierBidPortalComponent,
      ),
  },
  {
    path: 'rma-tracking',
    data: { publicPage: true, title: 'RMA.TRACKING.TITLE' },
    loadComponent: () =>
      import('./features/warranty-rma/public/rma-tracking.component').then(
        (m) => m.RmaTrackingComponent,
      ),
  },
  {
    // The live catalog of the design system: tokens, components, theme, density and brand controls.
    path: 'design-system',
    canActivate: [authGuard],
    data: { breadcrumb: 'DESIGN_SYSTEM.TITLE', title: 'DESIGN_SYSTEM.TITLE' },
    loadComponent: () =>
      import('./features/design-system/design-system.component').then(
        (m) => m.DesignSystemComponent,
      ),
  },
  {
    path: 'tools',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.TOOLS', title: 'PAGE_TITLE.STRUMENTI' },
    loadChildren: () => import('./features/tools/tools.routes').then((m) => m.TOOLS_ROUTES),
  },
  {
    path: 'modules',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.MODULES', title: 'PAGE_TITLE.MODULI_PRINCIPALI' },
    loadChildren: () => import('./features/modules/modules.routes').then((m) => m.MODULES_ROUTES),
  },
  {
    path: 'sectors',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.SECTORS', title: 'PAGE_TITLE.SETTORI' },
    loadChildren: () => import('./features/sectors/sectors.routes').then((m) => m.SECTORS_ROUTES),
  },
  {
    path: 'advanced',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.ADVANCED', title: 'PAGE_TITLE.FUNZIONALITA_AVANZATE' },
    loadChildren: () =>
      import('./features/advanced/advanced.routes').then((m) => m.ADVANCED_ROUTES),
  },
  {
    path: 'docs',
    canActivate: [authGuard, menuEnabledGuard],
    data: { breadcrumb: 'NAV.DOCS', title: 'PAGE_TITLE.DOCUMENTAZIONE' },
    loadChildren: () => import('./features/docs/docs.routes').then((m) => m.DOCS_ROUTES),
  },
  {
    path: 'association-area',
    data: { title: 'PAGE_TITLE.AREA_SOCI' },
    loadComponent: () =>
      import('./features/association-area/association-area.component').then(
        (m) => m.AssociationAreaComponent,
      ),
  },
  {
    path: 'association-enrolment/:token',
    data: { title: 'PAGE_TITLE.ISCRIZIONE_ONLINE' },
    loadComponent: () =>
      import('./features/association-enrolment/association-enrolment.component').then(
        (m) => m.AssociationEnrolmentComponent,
      ),
  },
  {
    // Interactive proposal portal (Mod 036): no auth guard, the unguessable token is the credential, no application shell.
    path: 'proposal/:token',
    data: { publicPage: true, title: 'PROPOSAL.TITLE' },
    loadComponent: () =>
      import('./features/proposal-portal/proposal-portal.component').then((m) => m.ProposalPortalComponent),
  },
  {
    // Public careers portal (Recruiting & ATS): no auth guard, embeddable.
    path: 'careers',
    data: { publicPage: true, title: 'CAREERS.TITLE' },
    loadChildren: () => import('./features/careers/careers.routes').then((m) => m.CAREERS_ROUTES),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
