import { Routes } from '@angular/router';
import { PRESERVATION_PAGE } from './preservation.page';

export const DOCUMENT_TRUST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./document-trust.component').then((m) => m.DocumentTrustComponent),
  },
  {
    path: 'preservation',
    data: { breadcrumb: 'RES.PAGE.DOCUMENT_PRESERVATION', title: 'RES.PAGE.DOCUMENT_PRESERVATION', page: PRESERVATION_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
