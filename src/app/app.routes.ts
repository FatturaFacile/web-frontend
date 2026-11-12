import { Routes } from '@angular/router';
import { authGuard, guestGuard, moduleGuard } from '@core/auth/auth.guard';

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
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.DASHBOARD', title: 'PAGE_TITLE.DASHBOARD_ESECUTIVA' },
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'crm',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.CRM_AND_ANAGRAFICHE', title: 'PAGE_TITLE.CRM_CROSS_BORDER' },
    loadChildren: () =>
      import('./features/crm/crm.routes').then((m) => m.CRM_ROUTES),
  },
  {
    path: 'sales',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.VENDITE_AND_FATTURAZIONE', title: 'PAGE_TITLE.VENDITE' },
    loadChildren: () =>
      import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES),
  },
  {
    path: 'purchases',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.ACQUISTI_AND_AP', title: 'PAGE_TITLE.ACQUISTI' },
    loadChildren: () =>
      import('./features/purchases/purchases.routes').then((m) => m.PURCHASES_ROUTES),
  },
  {
    path: 'procurement',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.APPROVVIGIONAMENTO', title: 'PAGE_TITLE.APPROVVIGIONAMENTO' },
    loadChildren: () =>
      import('./features/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES),
  },
  {
    path: 'treasury',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.TESORERIA_AND_BANCHE', title: 'PAGE_TITLE.TESORERIA' },
    loadChildren: () =>
      import('./features/treasury/treasury.routes').then((m) => m.TREASURY_ROUTES),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.MAGAZZINO_AND_LOGISTICA', title: 'PAGE_TITLE.MAGAZZINO' },
    loadChildren: () =>
      import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
  },
  {
    path: 'customs',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.DOGANA_IT_CH', title: 'PAGE_TITLE.DOGANA_SPEDIZIONI_IT_CH' },
    loadChildren: () =>
      import('./features/customs/customs.routes').then((m) => m.CUSTOMS_ROUTES),
  },
  {
    path: 'workflows',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.PROCESSI_AND_APPROVAZIONI', title: 'PAGE_TITLE.WORKFLOW_APPROVAZIONI' },
    loadChildren: () =>
      import('./features/workflows/workflows.routes').then((m) => m.WORKFLOW_ROUTES),
  },
  {
    path: 'dms',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.GESTIONE_DOCUMENTALE_DMS', title: 'PAGE_TITLE.DMS_ARCHIVIO' },
    loadChildren: () =>
      import('./features/dms/dms.routes').then((m) => m.DMS_ROUTES),
  },
  {
    path: 'contract-register',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.REGISTRO_CONTRATTI', title: 'PAGE_TITLE.REGISTRO_CONTRATTI_OBBLIGAZIONI' },
    loadChildren: () =>
      import('./features/contract-register/contract-register.routes').then((m) => m.CONTRACT_REGISTER_ROUTES),
  },
  {
    path: 'associations/governance',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.GOVERNANCE_E_CONFORMITA', title: 'PAGE_TITLE.GOVERNANCE_E_CONFORMITA_DELLE_ASSOCIAZIONI' },
    loadChildren: () =>
      import('./features/associations/governance/governance.routes').then((m) => m.ASSOCIATIONS_GOVERNANCE_ROUTES),
  },
  {
    path: 'associations',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.ASSOCIAZIONI_AND_TERZO_SETTORE', title: 'PAGE_TITLE.ASSOCIAZIONI_ETS_SPORTIVE' },
    loadChildren: () =>
      import('./features/associations/associations.routes').then((m) => m.ASSOCIATIONS_ROUTES),
  },
  {
    path: 'childcare',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.INFANZIA_AND_ASILO_NIDO', title: 'PAGE_TITLE.INFANZIA_ASILO_NIDO' },
    loadChildren: () =>
      import('./features/childcare/childcare.routes').then((m) => m.CHILDCARE_ROUTES),
  },
  {
    path: 'portal',
    data: { breadcrumb: 'NAV.PORTAL', title: 'PAGE_TITLE.AREA_CLIENTI_PORTALE_B2B' },
    loadChildren: () =>
      import('./features/portal/portal.routes').then((m) => m.PORTAL_ROUTES),
  },
  {
    path: 'intrastat',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.INTRASTAT', title: 'PAGE_TITLE.ELENCHI_INTRASTAT_UE' },
    loadChildren: () =>
      import('./features/intrastat/intrastat.routes').then((m) => m.INTRASTAT_ROUTES),
  },
  {
    path: 'document-trust',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.DOCUMENT_TRUST', title: 'PAGE_TITLE.RETI_E_DOCUMENT_DIGITAL_TRUST' },
    loadChildren: () =>
      import('./features/document-trust/document-trust.routes').then((m) => m.DOCUMENT_TRUST_ROUTES),
  },
  {
    path: 'ecommerce-integrations',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.ECOMMERCE_INTEGRATIONS', title: 'PAGE_TITLE.E_COMMERCE_INTEGRAZIONI_API' },
    loadChildren: () =>
      import('./features/ecommerce-integrations/ecommerce-integrations.routes').then((m) => m.ECOMMERCE_INTEGRATIONS_ROUTES),
  },
  {
    path: 'tessera-sanitaria',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.TESSERA_SANITARIA', title: 'PAGE_TITLE.SISTEMA_TESSERA_SANITARIA_STS' },
    loadChildren: () =>
      import('./features/tessera-sanitaria/tessera-sanitaria.routes').then((m) => m.TESSERA_SANITARIA_ROUTES),
  },
  {
    path: 'visitors',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.VISITORS', title: 'PAGE_TITLE.VISITATORI_KIOSK_RECEPTION' },
    loadChildren: () =>
      import('./features/visitors/visitors.routes').then((m) => m.VISITORS_ROUTES),
  },
  {
    path: 'communication',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.COMMUNICATION', title: 'PAGE_TITLE.COMUNICAZIONI_MULTI_CANALE' },
    loadChildren: () =>
      import('./features/communication/communication.routes').then((m) => m.COMMUNICATION_ROUTES),
  },
  {
    path: 'appointments',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.AGENDA_AND_APPUNTAMENTI', title: 'PAGE_TITLE.APPUNTAMENTI_CALENDARIO' },
    loadChildren: () =>
      import('./features/appointments/appointments.routes').then((m) => m.APPOINTMENTS_ROUTES),
  },
  {
    path: 'field-service',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.ASSISTENZA_AND_INTERVENTI', title: 'PAGE_TITLE.ASSISTENZA' },
    loadChildren: () =>
      import('./features/field-service/field-service.routes').then((m) => m.FIELD_SERVICE_ROUTES),
  },
  {
    path: 'helpdesk',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.HELPDESK_AND_ITSM', title: 'PAGE_TITLE.HELPDESK' },
    loadChildren: () =>
      import('./features/helpdesk/helpdesk.routes').then((m) => m.HELPDESK_ROUTES),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.PROGETTI_AND_COMMESSE', title: 'PAGE_TITLE.PROGETTI' },
    loadChildren: () =>
      import('./features/projects/projects.routes').then((m) => m.PROJECTS_ROUTES),
  },
  {
    path: 'assets',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.CESPITI_AND_ASSET_EAM', title: 'PAGE_TITLE.CESPITI' },
    loadChildren: () =>
      import('./features/assets/assets.routes').then((m) => m.ASSETS_ROUTES),
  },
  {
    path: 'catalog',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.ANAGRAFICHE_CATALOGO', title: 'PAGE_TITLE.ANAGRAFICHE_CATALOGO' },
    loadComponent: () =>
      import('./features/catalog/catalog-master-data.component').then((m) => m.CatalogMasterDataComponent),
  },
  {
    path: 'subscriptions',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.ABBONAMENTI_AND_CONTRATTI_RECURRENTI', title: 'PAGE_TITLE.ABBONAMENTI' },
    loadChildren: () =>
      import('./features/subscriptions/subscriptions.routes').then((m) => m.SUBSCRIPTIONS_ROUTES),
  },
  {
    path: 'automotive',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.AUTOMOTIVE_AND_GOMME', title: 'PAGE_TITLE.AUTOMOTIVE' },
    loadChildren: () =>
      import('./features/automotive/automotive.routes').then((m) => m.AUTOMOTIVE_ROUTES),
  },
  {
    path: 'rent',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.NOLEGGIO_FLOTTE', title: 'PAGE_TITLE.NOLEGGIO' },
    loadChildren: () =>
      import('./features/rent/rent.routes').then((m) => m.RENT_ROUTES),
  },
  {
    path: 'construction',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.CANTIERI_AND_IMPIANTI', title: 'PAGE_TITLE.CANTIERI' },
    loadChildren: () =>
      import('./features/construction/construction.routes').then((m) => m.CONSTRUCTION_ROUTES),
  },
  {
    path: 'professionals',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.STUDI_PROFESSIONALI', title: 'PAGE_TITLE.STUDI_PROFESSIONALI' },
    loadChildren: () =>
      import('./features/professionals/professionals.routes').then((m) => m.PROFESSIONALS_ROUTES),
  },
  {
    path: 'manufacturing',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.PRODUZIONE_AND_MRP', title: 'PAGE_TITLE.PRODUZIONE' },
    loadChildren: () =>
      import('./features/manufacturing/manufacturing.routes').then((m) => m.MANUFACTURING_ROUTES),
  },
  {
    path: 'hospitality',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.RISTORAZIONE_AND_HOSPITALITY', title: 'PAGE_TITLE.HOSPITALITY_COMANDE' },
    loadChildren: () =>
      import('./features/hospitality/hospitality.routes').then((m) => m.HOSPITALITY_ROUTES),
  },
  {
    path: 'retail',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.VENDITA_AL_BANCO_AND_POS', title: 'POS' },
    loadChildren: () =>
      import('./features/retail/retail.routes').then((m) => m.RETAIL_ROUTES),
  },
  {
    // The old clock screen called the deprecated /time-attendance/* endpoints: working time now lives in /hr/time.
    path: 'time-attendance',
    pathMatch: 'full',
    redirectTo: 'hr/time',
  },
  {
    path: 'hr',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.PAYROLL_AND_HR_IT_CH', title: 'PAGE_TITLE.HR_PAYROLL' },
    loadChildren: () =>
      import('./features/hr/hr.routes').then((m) => m.HR_ROUTES),
  },
  {
    path: 'exports',
    canActivate: [authGuard, moduleGuard('exports', 'read')],
    data: { breadcrumb: 'NAV.EXPORTS', title: 'NAV.EXPORTS' },
    loadComponent: () => import('./features/exports/exports.component').then((m) => m.ExportsComponent),
  },
  {
    path: 'accounting',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.CONTABILITA_AND_FISCALE', title: 'PAGE_TITLE.CONTABILITA' },
    loadChildren: () =>
      import('./features/accounting/accounting.routes').then((m) => m.ACCOUNTING_ROUTES),
  },
  {
    path: 'general-ledger',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.GENERAL_LEDGER', title: 'NAV.GENERAL_LEDGER' },
    loadChildren: () =>
      import('./features/general-ledger/general-ledger.routes').then((m) => m.GENERAL_LEDGER_ROUTES),
  },
  {
    path: 'alerts',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.CENTRO_AVVISI', title: 'PAGE_TITLE.CENTRO_AVVISI' },
    loadChildren: () =>
      import('./features/alerts/alerts.routes').then((m) => m.ALERTS_ROUTES),
  },
  {
    path: 'system',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.SISTEMA_AND_BACKUP', title: 'PAGE_TITLE.SISTEMA' },
    loadChildren: () =>
      import('./features/system/system.routes').then((m) => m.SYSTEM_ROUTES),
  },
  {
    path: 'workspace',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.WORKSPACE', title: 'NAV.WORKSPACE' },
    loadComponent: () =>
      import('./features/workspace/workspace.component').then((m) => m.WorkspaceComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.IMPOSTAZIONI_AND_TENANT', title: 'PAGE_TITLE.IMPOSTAZIONI' },
    loadChildren: () =>
      import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.STORICO_ORDINI', title: 'PAGE_TITLE.STORICO_ORDINI' },
    loadChildren: () =>
      import('./features/order-history').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'welcome',
    canActivate: [authGuard],
    data: { breadcrumb: 'BREADCRUMB.BENVENUTO', title: 'PAGE_TITLE.BENVENUTO' },
    loadChildren: () =>
      import('./features/welcome').then((m) => m.WELCOME_ROUTES),
  },
  {
    path: 'tools',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.TOOLS', title: 'PAGE_TITLE.STRUMENTI' },
    loadChildren: () => import('./features/tools/tools.routes').then((m) => m.TOOLS_ROUTES),
  },
  {
    path: 'modules',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.MODULES', title: 'PAGE_TITLE.MODULI_PRINCIPALI' },
    loadChildren: () => import('./features/modules/modules.routes').then((m) => m.MODULES_ROUTES),
  },
  {
    path: 'sectors',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.SECTORS', title: 'PAGE_TITLE.SETTORI' },
    loadChildren: () => import('./features/sectors/sectors.routes').then((m) => m.SECTORS_ROUTES),
  },
  {
    path: 'advanced',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.ADVANCED', title: 'PAGE_TITLE.FUNZIONALITA_AVANZATE' },
    loadChildren: () => import('./features/advanced/advanced.routes').then((m) => m.ADVANCED_ROUTES),
  },
  {
    path: 'docs',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.DOCS', title: 'PAGE_TITLE.DOCUMENTAZIONE' },
    loadChildren: () => import('./features/docs/docs.routes').then((m) => m.DOCS_ROUTES),
  },
  {
    path: 'association-area',
    data: { title: 'PAGE_TITLE.AREA_SOCI' },
    loadComponent: () =>
      import('./features/association-area/association-area.component').then((m) => m.AssociationAreaComponent),
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
    path: '**',
    redirectTo: 'dashboard',
  },
];
