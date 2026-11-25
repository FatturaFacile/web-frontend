import { Routes } from '@angular/router';

export const PLM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.PLM_CHANGE_ORDERS', title: 'PAGE_TITLE.PLM_CHANGE_ORDERS' },
    loadComponent: () => import('./plm-change-orders.component').then((m) => m.PlmChangeOrdersComponent),
  },
  {
    path: 'revisions',
    data: { breadcrumb: 'NAV.PLM_REVISIONS', title: 'PAGE_TITLE.PLM_REVISIONS' },
    loadComponent: () => import('./plm-revisions.component').then((m) => m.PlmRevisionsComponent),
  },
  {
    path: 'cad-import',
    data: { breadcrumb: 'NAV.PLM_CAD_IMPORT', title: 'PAGE_TITLE.PLM_CAD_IMPORT' },
    loadComponent: () => import('./plm-cad-import.component').then((m) => m.PlmCadImportComponent),
  },
  {
    path: 'bom-diff',
    data: { breadcrumb: 'NAV.PLM_BOM_DIFF', title: 'PAGE_TITLE.PLM_BOM_DIFF' },
    loadComponent: () => import('./plm-bom-diff.component').then((m) => m.PlmBomDiffComponent),
  },
  {
    path: 'where-used',
    data: { breadcrumb: 'NAV.PLM_WHERE_USED', title: 'PAGE_TITLE.PLM_WHERE_USED' },
    loadComponent: () => import('./plm-where-used.component').then((m) => m.PlmWhereUsedComponent),
  },
  {
    path: 'change-orders/:id',
    data: { breadcrumb: 'NAV.PLM_CHANGE_ORDER', title: 'PAGE_TITLE.PLM_CHANGE_ORDER' },
    loadComponent: () => import('./plm-change-order-detail.component').then((m) => m.PlmChangeOrderDetailComponent),
  },
];
