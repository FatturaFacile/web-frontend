import { Routes } from '@angular/router';

/** Order billing, billing plans, debit notes, reports and invoice approvals, mounted under `/sales/billing`. */
export const BILLING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'plans' },
  {
    path: 'plans',
    data: { breadcrumb: 'Piani di fatturazione', title: 'Piani di fatturazione' },
    loadComponent: () => import('./plans/billing-plans.component').then((m) => m.BillingPlansComponent),
  },
  {
    path: 'deferred',
    data: { breadcrumb: 'Fatturazione differita', title: 'Fatturazione differita' },
    loadComponent: () => import('./deferred/deferred-billing.component').then((m) => m.DeferredBillingComponent),
  },
  {
    path: 'debit-notes',
    data: { breadcrumb: 'Note di debito', title: 'Note di debito' },
    loadComponent: () => import('./debit-note/debit-note.component').then((m) => m.DebitNoteComponent),
  },
  {
    path: 'reports',
    data: { breadcrumb: 'Registro vendite e scadenzario', title: 'Registro vendite e scadenzario' },
    loadComponent: () => import('./reports/billing-reports.component').then((m) => m.BillingReportsComponent),
  },
  {
    path: 'approvals',
    data: { breadcrumb: 'Approvazione fatture', title: 'Approvazione fatture' },
    loadComponent: () => import('./approvals/invoice-approvals.component').then((m) => m.InvoiceApprovalsComponent),
  },
];
