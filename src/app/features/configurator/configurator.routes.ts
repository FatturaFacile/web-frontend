import { Routes } from '@angular/router';

export const CONFIGURATOR_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.CONFIGURATOR', title: 'PAGE_TITLE.CONFIGURATORE_PRODOTTI' },
    loadComponent: () => import('./configurator.component').then((m) => m.ConfiguratorComponent),
  },
  {
    path: 'models/:id',
    data: { breadcrumb: 'CONFIGURATOR.MODEL_EDITOR', title: 'PAGE_TITLE.CONFIGURATORE_PRODOTTI' },
    loadComponent: () => import('./model-editor.component').then((m) => m.ModelEditorComponent),
  },
  {
    path: 'configure',
    data: { breadcrumb: 'CONFIGURATOR.GUIDED_CONFIGURATION', title: 'PAGE_TITLE.CONFIGURATORE_PRODOTTI' },
    loadComponent: () => import('./configure.component').then((m) => m.ConfigureComponent),
  },
];
