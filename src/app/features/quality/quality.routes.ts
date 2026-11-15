import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { QUALITY_AUDITS_PAGE, QUALITY_CAPA_PAGE, QUALITY_NONCONFORMITIES_PAGE } from './qms.pages';

export const QUALITY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'spc' },
  {
    path: 'spc',
    data: { breadcrumb: 'NAV.QUALITY_SPC', title: 'PAGE_TITLE.QUALITY_SPC' },
    loadComponent: () => import('./quality-spc.component').then((m) => m.QualitySpcComponent),
  },
  {
    path: 'instruments',
    data: { breadcrumb: 'NAV.QUALITY_INSTRUMENTS', title: 'PAGE_TITLE.QUALITY_INSTRUMENTS' },
    loadComponent: () => import('./quality-instruments.component').then((m) => m.QualityInstrumentsComponent),
  },
  {
    path: 'complaints',
    data: { breadcrumb: 'NAV.QUALITY_COMPLAINTS', title: 'PAGE_TITLE.QUALITY_COMPLAINTS' },
    loadComponent: () => import('./quality-complaints.component').then((m) => m.QualityComplaintsComponent),
  },
  {
    path: 'nonconformities',
    data: { breadcrumb: 'RES.PAGE.QUALITY_NONCONFORMITIES', title: 'RES.PAGE.QUALITY_NONCONFORMITIES', page: QUALITY_NONCONFORMITIES_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'capa',
    data: { breadcrumb: 'RES.PAGE.QUALITY_CAPA', title: 'RES.PAGE.QUALITY_CAPA', page: QUALITY_CAPA_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'audits',
    data: { breadcrumb: 'RES.PAGE.QUALITY_AUDITS', title: 'RES.PAGE.QUALITY_AUDITS', page: QUALITY_AUDITS_PAGE },
    component: ResourcePageComponent,
  },
];
