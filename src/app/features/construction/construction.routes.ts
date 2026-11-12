import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { CONSTRUCTION_TRADES_PAGE } from './back-office/trades.page';

export const CONSTRUCTION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'BREADCRUMB.CANTIERI_AND_IMPIANTI', title: 'PAGE_TITLE.CANTIERI_IMPIANTI' },
    loadComponent: () =>
      import('./construction.component').then((m) => m.ConstructionComponent),
  },
  {
    path: 'back-office',
    data: { breadcrumb: 'RES.PAGE.CONSTRUCTION_TRADES', title: 'RES.PAGE.CONSTRUCTION_TRADES', page: CONSTRUCTION_TRADES_PAGE },
    component: ResourcePageComponent,
  },
];
