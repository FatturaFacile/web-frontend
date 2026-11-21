import { Routes } from '@angular/router';

export const CPQ_QUOTES_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'CPQ_QUOTES.TITLE', title: 'CPQ_QUOTES.TITLE' },
    loadComponent: () => import('./quote-list.component').then((m) => m.QuoteListComponent),
  },
  {
    path: ':id/compare',
    data: { breadcrumb: 'CPQ_QUOTES.HISTORY_TITLE', title: 'CPQ_QUOTES.HISTORY_TITLE' },
    loadComponent: () =>
      import('./quote-revision-compare.component').then((m) => m.QuoteRevisionCompareComponent),
  },
  {
    path: ':id',
    data: { breadcrumb: 'CPQ_QUOTES.EDITOR_TITLE', title: 'CPQ_QUOTES.EDITOR_TITLE' },
    loadComponent: () => import('./quote-editor.component').then((m) => m.QuoteEditorComponent),
  },
];
