import { Routes } from '@angular/router';

export const EVENTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.EVENTS_LIST', title: 'PAGE_TITLE.EVENTS_LIST' },
    loadComponent: () => import('./events-list.component').then((m) => m.EventsListComponent),
  },
  {
    path: 'check-in',
    data: { breadcrumb: 'NAV.EVENTS_CHECKIN', title: 'PAGE_TITLE.EVENTS_CHECKIN' },
    loadComponent: () => import('./events-checkin.component').then((m) => m.EventsCheckinComponent),
  },
  {
    path: ':id',
    data: { breadcrumb: 'NAV.EVENTS_DETAIL', title: 'PAGE_TITLE.EVENTS_DETAIL' },
    loadComponent: () => import('./event-detail.component').then((m) => m.EventDetailComponent),
  },
];
