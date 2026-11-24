import { Routes } from '@angular/router';

export const TESSERA_SANITARIA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tessera-sanitaria.component').then((m) => m.TesseraSanitariaComponent),
  },
];
