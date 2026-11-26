import { Routes } from '@angular/router';

/** Product catalog (Mod 052). The parent route guards the module (see `app.routes.ts`). */
export const PRODUCT_CATALOG_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.PRODUCT_CATALOG_PRODUCTS', title: 'PAGE_TITLE.PRODUCT_CATALOG' },
    loadComponent: () =>
      import('./catalog-products.component').then((m) => m.CatalogProductsComponent),
  },
  {
    path: 'attributes',
    data: {
      breadcrumb: 'NAV.PRODUCT_CATALOG_ATTRIBUTES',
      title: 'PAGE_TITLE.PRODUCT_CATALOG_ATTRIBUTES',
    },
    loadComponent: () => import('./attributes.component').then((m) => m.AttributesComponent),
  },
  {
    path: 'import-export',
    data: {
      breadcrumb: 'NAV.PRODUCT_CATALOG_TRANSFER',
      title: 'PAGE_TITLE.PRODUCT_CATALOG_TRANSFER',
    },
    loadComponent: () =>
      import('./catalog-transfer.component').then((m) => m.CatalogTransferComponent),
  },
];
