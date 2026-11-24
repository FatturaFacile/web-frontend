import { Routes } from '@angular/router';
import { ItalianVatStore } from './italian-vat.store';

export const ITALIAN_VAT_ROUTES: Routes = [
  {
    path: '',
    providers: [ItalianVatStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'registers' },
      {
        path: 'registers',
        data: {
          breadcrumb: 'NAV.ITALIAN_VAT_REGISTERS',
          title: 'PAGE_TITLE.ITALIAN_VAT_REGISTERS',
        },
        loadComponent: () =>
          import('./italian-vat-registers.component').then((m) => m.ItalianVatRegistersComponent),
      },
      {
        path: 'plafond',
        data: { breadcrumb: 'NAV.ITALIAN_VAT_PLAFOND', title: 'PAGE_TITLE.ITALIAN_VAT_PLAFOND' },
        loadComponent: () =>
          import('./italian-vat-plafond.component').then((m) => m.ItalianVatPlafondComponent),
      },
      {
        path: 'lipe',
        data: { breadcrumb: 'NAV.ITALIAN_VAT_LIPE', title: 'PAGE_TITLE.ITALIAN_VAT_LIPE' },
        loadComponent: () =>
          import('./italian-vat-lipe.component').then((m) => m.ItalianVatLipeComponent),
      },
      {
        path: 'annual',
        data: { breadcrumb: 'NAV.ITALIAN_VAT_ANNUAL', title: 'PAGE_TITLE.ITALIAN_VAT_ANNUAL' },
        loadComponent: () =>
          import('./italian-vat-annual.component').then((m) => m.ItalianVatAnnualComponent),
      },
      {
        path: 'cu',
        data: { breadcrumb: 'NAV.ITALIAN_VAT_CU', title: 'PAGE_TITLE.ITALIAN_VAT_CU' },
        loadComponent: () =>
          import('./italian-vat-cu.component').then((m) => m.ItalianVatCuComponent),
      },
    ],
  },
];
