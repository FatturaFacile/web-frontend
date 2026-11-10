import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/auth/auth.guard';

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
    data: { title: 'Accedi a Fattura Facile' },
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    pathMatch: 'full',
    canActivate: [guestGuard],
    data: { title: 'Registrati a Fattura Facile' },
    loadComponent: () =>
      import('./features/auth/pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'register/check-email',
    canActivate: [guestGuard],
    data: { title: 'Controlla la tua email' },
    loadComponent: () =>
      import('./features/auth/pages/check-email/check-email.component').then(
        (m) => m.CheckEmailComponent,
      ),
  },
  {
    path: 'verify-email',
    canActivate: [guestGuard],
    data: { title: 'Conferma email' },
    loadComponent: () =>
      import('./features/auth/pages/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent,
      ),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    data: { title: 'Password dimenticata' },
    loadComponent: () =>
      import('./features/auth/pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    data: { title: 'Reimposta password' },
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'password-updated',
    canActivate: [guestGuard],
    data: { title: 'Password aggiornata' },
    loadComponent: () =>
      import('./features/auth/pages/password-updated/password-updated.component').then(
        (m) => m.PasswordUpdatedComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    data: { breadcrumb: 'Dashboard', title: 'Dashboard Esecutiva' },
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'crm',
    canActivate: [authGuard],
    data: { breadcrumb: 'CRM & Anagrafiche', title: 'CRM Cross-Border' },
    loadChildren: () =>
      import('./features/crm/crm.routes').then((m) => m.CRM_ROUTES),
  },
  {
    path: 'sales',
    canActivate: [authGuard],
    data: { breadcrumb: 'Vendite & Fatturazione', title: 'Vendite' },
    loadChildren: () =>
      import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES),
  },
  {
    path: 'purchases',
    canActivate: [authGuard],
    data: { breadcrumb: 'Acquisti & AP', title: 'Acquisti' },
    loadChildren: () =>
      import('./features/purchases/purchases.routes').then((m) => m.PURCHASES_ROUTES),
  },
  {
    path: 'procurement',
    canActivate: [authGuard],
    data: { breadcrumb: 'Approvvigionamento', title: 'Approvvigionamento' },
    loadChildren: () =>
      import('./features/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES),
  },
  {
    path: 'treasury',
    canActivate: [authGuard],
    data: { breadcrumb: 'Tesoreria & Banche', title: 'Tesoreria' },
    loadChildren: () =>
      import('./features/treasury/treasury.routes').then((m) => m.TREASURY_ROUTES),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    data: { breadcrumb: 'Magazzino & Logistica', title: 'Magazzino' },
    loadChildren: () =>
      import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
  },
  {
    path: 'customs',
    canActivate: [authGuard],
    data: { breadcrumb: 'Dogana IT-CH', title: 'Dogana & Spedizioni IT-CH' },
    loadChildren: () =>
      import('./features/customs/customs.routes').then((m) => m.CUSTOMS_ROUTES),
  },
  {
    path: 'workflows',
    canActivate: [authGuard],
    data: { breadcrumb: 'Processi & Approvazioni', title: 'Workflow & Approvazioni' },
    loadChildren: () =>
      import('./features/workflows/workflows.routes').then((m) => m.WORKFLOW_ROUTES),
  },
  {
    path: 'dms',
    canActivate: [authGuard],
    data: { breadcrumb: 'Gestione Documentale (DMS)', title: 'DMS & Archivio' },
    loadChildren: () =>
      import('./features/dms/dms.routes').then((m) => m.DMS_ROUTES),
  },
  {
    path: 'contract-register',
    canActivate: [authGuard],
    data: { breadcrumb: 'Registro Contratti', title: 'Registro Contratti & Obbligazioni' },
    loadChildren: () =>
      import('./features/contract-register/contract-register.routes').then((m) => m.CONTRACT_REGISTER_ROUTES),
  },
  {
    path: 'associations/governance',
    canActivate: [authGuard],
    data: { breadcrumb: 'Governance e conformità', title: 'Governance e conformità delle associazioni' },
    loadChildren: () =>
      import('./features/associations/governance/governance.routes').then((m) => m.ASSOCIATIONS_GOVERNANCE_ROUTES),
  },
  {
    path: 'associations',
    canActivate: [authGuard],
    data: { breadcrumb: 'Associazioni & Terzo Settore', title: 'Associazioni ETS & Sportive' },
    loadChildren: () =>
      import('./features/associations/associations.routes').then((m) => m.ASSOCIATIONS_ROUTES),
  },
  {
    path: 'childcare',
    canActivate: [authGuard],
    data: { breadcrumb: 'Infanzia & Asilo Nido', title: 'Infanzia & Asilo Nido' },
    loadChildren: () =>
      import('./features/childcare/childcare.routes').then((m) => m.CHILDCARE_ROUTES),
  },
  {
    path: 'portal',
    data: { breadcrumb: 'NAV.PORTAL', title: 'Area Clienti & Portale B2B' },
    loadChildren: () =>
      import('./features/portal/portal.routes').then((m) => m.PORTAL_ROUTES),
  },
  {
    path: 'intrastat',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.INTRASTAT', title: 'Elenchi Intrastat UE' },
    loadChildren: () =>
      import('./features/intrastat/intrastat.routes').then((m) => m.INTRASTAT_ROUTES),
  },
  {
    path: 'document-trust',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.DOCUMENT_TRUST', title: 'Reti E-Document & Digital Trust' },
    loadChildren: () =>
      import('./features/document-trust/document-trust.routes').then((m) => m.DOCUMENT_TRUST_ROUTES),
  },
  {
    path: 'ecommerce-integrations',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.ECOMMERCE_INTEGRATIONS', title: 'E-commerce & Integrazioni API' },
    loadChildren: () =>
      import('./features/ecommerce-integrations/ecommerce-integrations.routes').then((m) => m.ECOMMERCE_INTEGRATIONS_ROUTES),
  },
  {
    path: 'tessera-sanitaria',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.TESSERA_SANITARIA', title: 'Sistema Tessera Sanitaria (STS)' },
    loadChildren: () =>
      import('./features/tessera-sanitaria/tessera-sanitaria.routes').then((m) => m.TESSERA_SANITARIA_ROUTES),
  },
  {
    path: 'visitors',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.VISITORS', title: 'Visitatori & Kiosk Reception' },
    loadChildren: () =>
      import('./features/visitors/visitors.routes').then((m) => m.VISITORS_ROUTES),
  },
  {
    path: 'communication',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.COMMUNICATION', title: 'Comunicazioni Multi-Canale' },
    loadChildren: () =>
      import('./features/communication/communication.routes').then((m) => m.COMMUNICATION_ROUTES),
  },
  {
    path: 'appointments',
    canActivate: [authGuard],
    data: { breadcrumb: 'Agenda & Appuntamenti', title: 'Appuntamenti & Calendario' },
    loadChildren: () =>
      import('./features/appointments/appointments.routes').then((m) => m.APPOINTMENTS_ROUTES),
  },
  {
    path: 'field-service',
    canActivate: [authGuard],
    data: { breadcrumb: 'Assistenza & Interventi', title: 'Assistenza' },
    loadChildren: () =>
      import('./features/field-service/field-service.routes').then((m) => m.FIELD_SERVICE_ROUTES),
  },
  {
    path: 'helpdesk',
    canActivate: [authGuard],
    data: { breadcrumb: 'Helpdesk & ITSM', title: 'Helpdesk' },
    loadChildren: () =>
      import('./features/helpdesk/helpdesk.routes').then((m) => m.HELPDESK_ROUTES),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    data: { breadcrumb: 'Progetti & Commesse', title: 'Progetti' },
    loadChildren: () =>
      import('./features/projects/projects.routes').then((m) => m.PROJECTS_ROUTES),
  },
  {
    path: 'assets',
    canActivate: [authGuard],
    data: { breadcrumb: 'Cespiti & Asset EAM', title: 'Cespiti' },
    loadChildren: () =>
      import('./features/assets/assets.routes').then((m) => m.ASSETS_ROUTES),
  },
  {
    path: 'catalog',
    canActivate: [authGuard],
    data: { breadcrumb: 'Anagrafiche catalogo', title: 'Anagrafiche catalogo' },
    loadComponent: () =>
      import('./features/catalog/catalog-master-data.component').then((m) => m.CatalogMasterDataComponent),
  },
  {
    path: 'subscriptions',
    canActivate: [authGuard],
    data: { breadcrumb: 'Abbonamenti & Contratti Recurrenti', title: 'Abbonamenti' },
    loadChildren: () =>
      import('./features/subscriptions/subscriptions.routes').then((m) => m.SUBSCRIPTIONS_ROUTES),
  },
  {
    path: 'automotive',
    canActivate: [authGuard],
    data: { breadcrumb: 'Automotive & Gomme', title: 'Automotive' },
    loadChildren: () =>
      import('./features/automotive/automotive.routes').then((m) => m.AUTOMOTIVE_ROUTES),
  },
  {
    path: 'rent',
    canActivate: [authGuard],
    data: { breadcrumb: 'Noleggio Flotte', title: 'Noleggio' },
    loadChildren: () =>
      import('./features/rent/rent.routes').then((m) => m.RENT_ROUTES),
  },
  {
    path: 'construction',
    canActivate: [authGuard],
    data: { breadcrumb: 'Cantieri & Impianti', title: 'Cantieri' },
    loadChildren: () =>
      import('./features/construction/construction.routes').then((m) => m.CONSTRUCTION_ROUTES),
  },
  {
    path: 'professionals',
    canActivate: [authGuard],
    data: { breadcrumb: 'Studi Professionali', title: 'Studi Professionali' },
    loadChildren: () =>
      import('./features/professionals/professionals.routes').then((m) => m.PROFESSIONALS_ROUTES),
  },
  {
    path: 'manufacturing',
    canActivate: [authGuard],
    data: { breadcrumb: 'Produzione & MRP', title: 'Produzione' },
    loadChildren: () =>
      import('./features/manufacturing/manufacturing.routes').then((m) => m.MANUFACTURING_ROUTES),
  },
  {
    path: 'hospitality',
    canActivate: [authGuard],
    data: { breadcrumb: 'Ristorazione & Hospitality', title: 'Hospitality & Comande' },
    loadChildren: () =>
      import('./features/hospitality/hospitality.routes').then((m) => m.HOSPITALITY_ROUTES),
  },
  {
    path: 'retail',
    canActivate: [authGuard],
    data: { breadcrumb: 'Vendita al Banco & POS', title: 'POS' },
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
    data: { breadcrumb: 'Payroll & HR IT-CH', title: 'HR & Payroll' },
    loadChildren: () =>
      import('./features/hr/hr.routes').then((m) => m.HR_ROUTES),
  },
  {
    path: 'accounting',
    canActivate: [authGuard],
    data: { breadcrumb: 'Contabilità & Fiscale', title: 'Contabilità' },
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
    data: { breadcrumb: 'Centro Avvisi', title: 'Centro Avvisi' },
    loadChildren: () =>
      import('./features/alerts/alerts.routes').then((m) => m.ALERTS_ROUTES),
  },
  {
    path: 'system',
    canActivate: [authGuard],
    data: { breadcrumb: 'Sistema & Backup', title: 'Sistema' },
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
    data: { breadcrumb: 'Impostazioni & Tenant', title: 'Impostazioni' },
    loadChildren: () =>
      import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    data: { breadcrumb: 'Storico Ordini', title: 'Storico Ordini' },
    loadChildren: () =>
      import('./features/order-history').then((m) => m.ORDER_ROUTES),
  },
  {
    path: 'welcome',
    canActivate: [authGuard],
    data: { breadcrumb: 'Benvenuto', title: 'Benvenuto' },
    loadChildren: () =>
      import('./features/welcome').then((m) => m.WELCOME_ROUTES),
  },
  {
    path: 'tools',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.TOOLS', title: 'Strumenti' },
    loadChildren: () => import('./features/tools/tools.routes').then((m) => m.TOOLS_ROUTES),
  },
  {
    path: 'modules',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.MODULES', title: 'Moduli Principali' },
    loadChildren: () => import('./features/modules/modules.routes').then((m) => m.MODULES_ROUTES),
  },
  {
    path: 'sectors',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.SECTORS', title: 'Settori' },
    loadChildren: () => import('./features/sectors/sectors.routes').then((m) => m.SECTORS_ROUTES),
  },
  {
    path: 'advanced',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.ADVANCED', title: 'Funzionalit� Avanzate' },
    loadChildren: () => import('./features/advanced/advanced.routes').then((m) => m.ADVANCED_ROUTES),
  },
  {
    path: 'docs',
    canActivate: [authGuard],
    data: { breadcrumb: 'NAV.DOCS', title: 'Documentazione' },
    loadChildren: () => import('./features/docs/docs.routes').then((m) => m.DOCS_ROUTES),
  },
  {
    path: 'association-area',
    data: { title: 'Area soci' },
    loadComponent: () =>
      import('./features/association-area/association-area.component').then((m) => m.AssociationAreaComponent),
  },
  {
    path: 'association-enrolment/:token',
    data: { title: 'Iscrizione online' },
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
