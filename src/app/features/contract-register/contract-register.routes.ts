import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
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
];
