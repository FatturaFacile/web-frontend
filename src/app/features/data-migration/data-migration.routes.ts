import { Routes } from '@angular/router';

export const DATA_MIGRATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./data-migration-wizard.component').then((m) => m.DataMigrationWizardComponent),
  },
];
