import { Routes } from '@angular/router';
import { placeholderRoute } from '../placeholder';

export const TOOLS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'vat-calculator' },
  {
    path: 'vat-calculator',
    data: { breadcrumb: 'NAV.TOOL_VAT', titleKey: 'NAV.TOOL_VAT' },
    loadComponent: () =>
      import('./vat-calculator/vat-calculator.component').then((m) => m.VatCalculatorComponent),
  },
  {
    path: 'margin-calculator',
    data: { breadcrumb: 'NAV.TOOL_MARGIN', titleKey: 'NAV.TOOL_MARGIN' },
    loadComponent: () =>
      import('./margin-calculator/margin-calculator.component').then(
        (m) => m.MarginCalculatorComponent,
      ),
  },
  placeholderRoute('commercial-letter', 'NAV.TOOL_LETTER'),
  placeholderRoute('vcard-qr', 'NAV.TOOL_VCARD'),
  placeholderRoute('qr-generator', 'NAV.TOOL_QR'),
  placeholderRoute('working-hours', 'NAV.TOOL_HOURS'),
  placeholderRoute('camt-statement', 'NAV.TOOL_CAMT'),
  placeholderRoute('qr-invoice', 'NAV.TOOL_QR_INVOICE'),
  placeholderRoute('pdf-editor', 'NAV.TOOL_PDF'),
];
