import { Routes } from '@angular/router';
import { placeholderRoute } from '../placeholder';

/** Core modules already implemented elsewhere keep a redirect so the requested `/modules/*` URLs resolve. */
export const MODULES_ROUTES: Routes = [
  { path: 'crm', pathMatch: 'full', redirectTo: '/crm' },
  { path: 'accounting', pathMatch: 'full', redirectTo: '/accounting' },
  { path: 'bank-reconciliation', pathMatch: 'full', redirectTo: '/treasury' },
  { path: 'invoicing', pathMatch: 'full', redirectTo: '/sales/invoices' },
  { path: 'hr', pathMatch: 'full', redirectTo: '/hr' },
  { path: 'production', pathMatch: 'full', redirectTo: '/manufacturing' },
  placeholderRoute('products', 'NAV.MOD_PRODUCTS'),
  placeholderRoute('agenda', 'NAV.MOD_AGENDA'),
  placeholderRoute('marketing', 'NAV.MOD_MARKETING'),
  placeholderRoute('forms', 'NAV.MOD_FORMS'),
];
