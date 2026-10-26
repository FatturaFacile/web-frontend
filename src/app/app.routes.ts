import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core';

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
    path: 'field-service',
    canActivate: [authGuard],
    data: { breadcrumb: 'Assistenza & Interventi', title: 'Assistenza' },
    loadChildren: () =>
      import('./features/field-service/field-service.routes').then((m) => m.FIELD_SERVICE_ROUTES),
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
    path: 'retail',
    canActivate: [authGuard],
    data: { breadcrumb: 'Vendita al Banco & POS', title: 'POS' },
    loadChildren: () =>
      import('./features/retail/retail.routes').then((m) => m.RETAIL_ROUTES),
  },
  {
    path: 'time-attendance',
    canActivate: [authGuard],
    data: { breadcrumb: 'Presenze & Cartellino', title: 'Presenze & Cartellino' },
    loadChildren: () =>
      import('./features/time-attendance/time-attendance.routes').then((m) => m.TIME_ATTENDANCE_ROUTES),
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
    path: '**',
    redirectTo: 'dashboard',
  },
];
