import { Routes } from '@angular/router';

export const SUPPLIER_PORTAL_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'SUPPLIER_PORTAL.PAGE_OVERVIEW', title: 'SUPPLIER_PORTAL.PAGE_OVERVIEW' },
    loadComponent: () => import('./supplier-overview.component').then((m) => m.SupplierOverviewComponent),
  },
  {
    path: 'onboardings',
    data: { breadcrumb: 'SUPPLIER_PORTAL.PAGE_ONBOARDINGS', title: 'SUPPLIER_PORTAL.PAGE_ONBOARDINGS' },
    loadComponent: () => import('./supplier-onboardings.component').then((m) => m.SupplierOnboardingsComponent),
  },
  {
    path: 'documents',
    data: { breadcrumb: 'SUPPLIER_PORTAL.PAGE_DOCUMENTS', title: 'SUPPLIER_PORTAL.PAGE_DOCUMENTS' },
    loadComponent: () => import('./supplier-documents.component').then((m) => m.SupplierDocumentsComponent),
  },
  {
    path: 'qualification',
    data: { breadcrumb: 'SUPPLIER_PORTAL.PAGE_QUALIFICATION', title: 'SUPPLIER_PORTAL.PAGE_QUALIFICATION' },
    loadComponent: () => import('./supplier-qualification.component').then((m) => m.SupplierQualificationComponent),
  },
  {
    path: 'bank-changes',
    data: { breadcrumb: 'SUPPLIER_PORTAL.PAGE_BANK_CHANGES', title: 'SUPPLIER_PORTAL.PAGE_BANK_CHANGES' },
    loadComponent: () => import('./supplier-bank-changes.component').then((m) => m.SupplierBankChangesComponent),
  },
  {
    path: 'rfq-responses',
    data: { breadcrumb: 'SUPPLIER_PORTAL.PAGE_RFQ_RESPONSES', title: 'SUPPLIER_PORTAL.PAGE_RFQ_RESPONSES' },
    loadComponent: () => import('./supplier-rfq-responses.component').then((m) => m.SupplierRfqResponsesComponent),
  },
];
