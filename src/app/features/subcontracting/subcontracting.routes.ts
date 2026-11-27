import { Routes } from '@angular/router';

/** Subcontracting (Mod 065). The parent route guards the module (see `app.routes.ts`). */
export const SUBCONTRACTING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    data: {
      breadcrumb: 'NAV.SUBCONTRACTING_DASHBOARD',
      title: 'PAGE_TITLE.SUBCONTRACTING_DASHBOARD',
    },
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'orders',
    data: {
      breadcrumb: 'NAV.SUBCONTRACTING_ORDERS',
      title: 'PAGE_TITLE.SUBCONTRACTING_ORDERS',
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./orders.component').then((m) => m.OrdersComponent),
      },
      {
        path: 'new',
        data: {
          breadcrumb: 'NAV.SUBCONTRACTING_ORDER_NEW',
          title: 'PAGE_TITLE.SUBCONTRACTING_ORDER_NEW',
        },
        loadComponent: () => import('./order-form.component').then((m) => m.OrderFormComponent),
      },
      {
        path: ':id',
        data: {
          breadcrumb: 'NAV.SUBCONTRACTING_ORDER_DETAIL',
          title: 'PAGE_TITLE.SUBCONTRACTING_ORDER_DETAIL',
        },
        loadComponent: () => import('./order-detail.component').then((m) => m.OrderDetailComponent),
      },
    ],
  },
  {
    path: 'register',
    data: {
      breadcrumb: 'NAV.SUBCONTRACTING_REGISTER',
      title: 'PAGE_TITLE.SUBCONTRACTING_REGISTER',
    },
    loadComponent: () => import('./register.component').then((m) => m.RegisterComponent),
  },
];
