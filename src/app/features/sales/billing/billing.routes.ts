import { Routes } from '@angular/router';
import { INVOICE_COLLECTIONS_PAGE, SALES_COMMISSIONS_PAGE, SALES_TAX_DATA_PAGE } from './billing-extras.page';

/** Order billing, billing plans, debit notes, reports and invoice approvals, mounted under `/sales/billing`. */
export const BILLING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'plans' },
  {
    path: 'plans',
    data: { breadcrumb: 'BREADCRUMB.PIANI_DI_FATTURAZIONE', title: 'PAGE_TITLE.PIANI_DI_FATTURAZIONE' },
    loadComponent: () => import('./plans/billing-plans.component').then((m) => m.BillingPlansComponent),
  },
  {
    path: 'deferred',
    data: { breadcrumb: 'BREADCRUMB.FATTURAZIONE_DIFFERITA', title: 'PAGE_TITLE.FATTURAZIONE_DIFFERITA' },
    loadComponent: () => import('./deferred/deferred-billing.component').then((m) => m.DeferredBillingComponent),
  },
  {
    path: 'debit-notes',
    data: { breadcrumb: 'BREADCRUMB.NOTE_DI_DEBITO', title: 'PAGE_TITLE.NOTE_DI_DEBITO' },
    loadComponent: () => import('./debit-note/debit-note.component').then((m) => m.DebitNoteComponent),
  },
  {
    path: 'reports',
    data: { breadcrumb: 'BREADCRUMB.REGISTRO_VENDITE_E_SCADENZARIO', title: 'PAGE_TITLE.REGISTRO_VENDITE_E_SCADENZARIO' },
    loadComponent: () => import('./reports/billing-reports.component').then((m) => m.BillingReportsComponent),
  },
  {
    path: 'approvals',
    data: { breadcrumb: 'BREADCRUMB.APPROVAZIONE_FATTURE', title: 'PAGE_TITLE.APPROVAZIONE_FATTURE' },
    loadComponent: () => import('./approvals/invoice-approvals.component').then((m) => m.InvoiceApprovalsComponent),
  },
  {
    path: 'collections',
    data: { breadcrumb: 'BREADCRUMB.INCASSI_E_SOLLECITI', title: 'PAGE_TITLE.INCASSI_E_SOLLECITI', page: INVOICE_COLLECTIONS_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'tax-data',
    data: { breadcrumb: 'BREADCRUMB.DICHIARAZIONI_D_INTENTO_E_CONTRIBUTI', title: 'PAGE_TITLE.DICHIARAZIONI_D_INTENTO_E_CONTRIBUTI', page: SALES_TAX_DATA_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'commissions',
    data: { breadcrumb: 'BREADCRUMB.PROVVIGIONI_E_OBIETTIVI', title: 'PAGE_TITLE.PROVVIGIONI_E_OBIETTIVI', page: SALES_COMMISSIONS_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
