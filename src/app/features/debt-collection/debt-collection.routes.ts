import { Routes } from '@angular/router';

/** Dunning and debt collection (Mod 014). The parent route guards the module (see `app.routes.ts`). */
export const DEBT_COLLECTION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'debtCollection.nav.title',
      title: 'debtCollection.title',
    },
    loadComponent: () =>
      import('./debt-collection.component').then((m) => m.DebtCollectionComponent),
  },
];
