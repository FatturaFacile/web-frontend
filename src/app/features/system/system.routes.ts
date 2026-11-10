import { Routes } from '@angular/router';

export const SYSTEM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'backups',
  },
  {
    path: 'backups',
    data: { breadcrumb: 'BREADCRUMB.BACKUP_AND_RIPRISTINO', title: 'Backup & Ripristino' },
    loadComponent: () =>
      import('./components/backups/backups.component').then((m) => m.BackupsComponent),
  },
];
