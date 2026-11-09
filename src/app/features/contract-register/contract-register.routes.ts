import { Routes } from '@angular/router';

export const CONTRACT_REGISTER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./contract-register.component').then((m) => m.ContractRegisterComponent),
  },
];
