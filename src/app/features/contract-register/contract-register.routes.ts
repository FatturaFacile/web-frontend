import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { CONTRACT_AUTHORING_PAGE } from './authoring.page';
import { CONTRACT_DOCUMENTS_PAGE } from './documents.page';

export const CONTRACT_REGISTER_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./contract-register.component').then((m) => m.ContractRegisterComponent),
  },
  {
    path: 'documents',
    data: { breadcrumb: 'RES.PAGE.CONTRACT_DOCUMENTS', title: 'RES.PAGE.CONTRACT_DOCUMENTS', page: CONTRACT_DOCUMENTS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'redline/:kind/:id',
    data: { breadcrumb: 'CONTRACT_REDLINE.TITLE', title: 'CONTRACT_REDLINE.TITLE' },
    loadComponent: () => import('./redline.component').then((m) => m.ContractRedlineComponent),
  },
  {
    path: 'authoring',
    data: { breadcrumb: 'RES.PAGE.CONTRACT_AUTHORING', title: 'RES.PAGE.CONTRACT_AUTHORING', page: CONTRACT_AUTHORING_PAGE },
    component: ResourcePageComponent,
  },
];
