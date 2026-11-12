import { Routes } from '@angular/router';

export const SYSTEM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'backups',
  },
  {
    path: 'backups',
    data: { breadcrumb: 'BREADCRUMB.BACKUP_AND_RIPRISTINO', title: 'PAGE_TITLE.BACKUP_RIPRISTINO' },
    loadComponent: () =>
      import('./components/backups/backups.component').then((m) => m.BackupsComponent),
  },
];
