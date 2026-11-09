import { Routes } from '@angular/router';

export const DOCUMENT_TRUST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./document-trust.component').then((m) => m.DocumentTrustComponent),
  },
];
