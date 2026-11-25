import { Routes } from '@angular/router';
import { moduleGuard } from '@core/auth/auth.guard';
import { CPQ_ADMIN_MODULE } from './cpq-format';

export const CPQ_CONFIGURATOR_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'CPQ_CONFIGURATOR.NAV', title: 'CPQ_CONFIGURATOR.TITLE' },
    loadComponent: () => import('./cpq-home.component').then((m) => m.CpqHomeComponent),
  },
  {
    path: 'configure',
    data: {
      breadcrumb: 'CPQ_CONFIGURATOR.CONFIGURE.TITLE',
      title: 'CPQ_CONFIGURATOR.CONFIGURE.TITLE',
    },
    loadComponent: () => import('./cpq-configure.component').then((m) => m.CpqConfigureComponent),
  },
  {
    path: 'configure/:modelId',
    data: {
      breadcrumb: 'CPQ_CONFIGURATOR.CONFIGURE.TITLE',
      title: 'CPQ_CONFIGURATOR.CONFIGURE.TITLE',
    },
    loadComponent: () => import('./cpq-configure.component').then((m) => m.CpqConfigureComponent),
  },
  {
    path: 'models',
    canActivate: [moduleGuard(CPQ_ADMIN_MODULE)],
    data: {
      breadcrumb: 'CPQ_CONFIGURATOR.MODELS_ADMIN.TITLE',
      title: 'CPQ_CONFIGURATOR.MODELS_ADMIN.TITLE',
    },
    loadComponent: () => import('./cpq-models.component').then((m) => m.CpqModelsComponent),
  },
  {
    path: 'models/:id',
    canActivate: [moduleGuard(CPQ_ADMIN_MODULE)],
    data: { breadcrumb: 'CPQ_CONFIGURATOR.EDITOR.TITLE', title: 'CPQ_CONFIGURATOR.EDITOR.TITLE' },
    loadComponent: () =>
      import('./cpq-model-editor.component').then((m) => m.CpqModelEditorComponent),
  },
];
