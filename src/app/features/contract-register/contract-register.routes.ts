import { Routes } from '@angular/router';
import { CONTRACT_AUTHORING_PAGE } from './authoring.page';
import { CONTRACT_DOCUMENTS_PAGE } from './documents.page';
import { CONTRACT_OPERATIONS_PAGE } from './operations.page';

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
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'redline/:kind/:id',
    data: { breadcrumb: 'CONTRACT_REDLINE.TITLE', title: 'CONTRACT_REDLINE.TITLE' },
    loadComponent: () => import('./redline.component').then((m) => m.ContractRedlineComponent),
  },
  {
    path: 'authoring',
    data: { breadcrumb: 'RES.PAGE.CONTRACT_AUTHORING', title: 'RES.PAGE.CONTRACT_AUTHORING', page: CONTRACT_AUTHORING_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'operations',
    data: { breadcrumb: 'RES.PAGE.CONTRACT_OPERATIONS', title: 'RES.PAGE.CONTRACT_OPERATIONS', page: CONTRACT_OPERATIONS_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
