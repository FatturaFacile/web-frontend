import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { ASSOC_COURSES_PAGE } from './pages/courses.page';
import { ASSOC_ENROLMENT_PAGE } from './pages/enrolment.page';
import { ASSOC_FEES_PAGE, ASSOC_FUNDRAISING_PAGE, ASSOC_SETTINGS_PAGE, ASSOC_SPORT_PAGE } from './pages/finance.page';
import { ASSOC_MEMBERSHIPS_PAGE } from './pages/members.page';
import { ASSOC_ACCESS_PAGE, ASSOC_COMPLIANCE_PAGE, ASSOC_VOLUNTEERS_PAGE } from './pages/operations.page';

const associationRoute = (path: string, title: string, page: object) => ({
  path,
  data: { breadcrumb: title, title, page },
  component: ResourcePageComponent,
});

export const ASSOCIATIONS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./associations.component').then((m) => m.AssociationsComponent),
  },
  associationRoute('memberships', 'Tessere & Soci', ASSOC_MEMBERSHIPS_PAGE),
  {
    path: 'members/:id',
    data: { breadcrumb: 'BREADCRUMB.SCHEDA_SOCIO', title: 'Scheda socio' },
    loadComponent: () =>
      import('./member-file/member-file.component').then((m) => m.AssociationMemberFileComponent),
  },
  associationRoute('courses', 'Corsi & Eventi', ASSOC_COURSES_PAGE),
  associationRoute('enrolment', 'Iscrizioni online', ASSOC_ENROLMENT_PAGE),
  associationRoute('compliance', 'Scadenze certificati e documenti', ASSOC_COMPLIANCE_PAGE),
  associationRoute('volunteers', 'Turni volontari', ASSOC_VOLUNTEERS_PAGE),
  associationRoute('access', 'Controllo accessi', ASSOC_ACCESS_PAGE),
  associationRoute('fees', 'Quote & Ricevute', ASSOC_FEES_PAGE),
  associationRoute('sport', 'Lavoro sportivo', ASSOC_SPORT_PAGE),
  associationRoute('fundraising', 'Raccolta fondi', ASSOC_FUNDRAISING_PAGE),
  associationRoute('settings', 'Impostazioni associazione', ASSOC_SETTINGS_PAGE),
];
