import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { CHILDCARE_CARE_PAGE } from './back-office/care.page';

export const CHILDCARE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'Infanzia & Asilo Nido', title: 'Infanzia & Asilo Nido' },
    loadComponent: () =>
      import('./childcare.component').then((m) => m.ChildcareComponent),
  },
  {
    path: 'care',
    data: { breadcrumb: 'RES.PAGE.CHILDCARE_CARE', title: 'RES.PAGE.CHILDCARE_CARE', page: CHILDCARE_CARE_PAGE },
    component: ResourcePageComponent,
  },
];
