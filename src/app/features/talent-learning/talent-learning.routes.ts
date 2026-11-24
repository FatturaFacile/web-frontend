import { Routes } from '@angular/router';

export const TALENT_LEARNING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_DASHBOARD', title: 'PAGE_TITLE.TALENT_LEARNING_DASHBOARD' },
    loadComponent: () => import('./talent-dashboard.component').then((m) => m.TalentDashboardComponent),
  },
  {
    path: 'succession',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_SUCCESSION', title: 'PAGE_TITLE.TALENT_LEARNING_SUCCESSION' },
    loadComponent: () => import('./talent-succession.component').then((m) => m.TalentSuccessionComponent),
  },
  {
    path: 'compensation',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_COMPENSATION', title: 'PAGE_TITLE.TALENT_LEARNING_COMPENSATION' },
    loadComponent: () => import('./talent-compensation.component').then((m) => m.TalentCompensationComponent),
  },
  {
    path: 'courses',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_COURSES', title: 'PAGE_TITLE.TALENT_LEARNING_COURSES' },
    loadComponent: () => import('./talent-courses.component').then((m) => m.TalentCoursesComponent),
  },
  {
    path: 'enrolments',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_ENROLMENTS', title: 'PAGE_TITLE.TALENT_LEARNING_ENROLMENTS' },
    loadComponent: () => import('./talent-enrolments.component').then((m) => m.TalentEnrolmentsComponent),
  },
  {
    path: 'certificates',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_CERTIFICATES', title: 'PAGE_TITLE.TALENT_LEARNING_CERTIFICATES' },
    loadComponent: () => import('./talent-certificates.component').then((m) => m.TalentCertificatesComponent),
  },
  {
    path: 'my-learning',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_MY_LEARNING', title: 'PAGE_TITLE.TALENT_LEARNING_MY_LEARNING' },
    loadComponent: () => import('./talent-my-learning.component').then((m) => m.TalentMyLearningComponent),
  },
  {
    path: 'compliance',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_COMPLIANCE', title: 'PAGE_TITLE.TALENT_LEARNING_COMPLIANCE' },
    loadComponent: () => import('./talent-compliance.component').then((m) => m.TalentComplianceComponent),
  },
  {
    path: 'surveys',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_SURVEYS', title: 'PAGE_TITLE.TALENT_LEARNING_SURVEYS' },
    loadComponent: () => import('./talent-surveys.component').then((m) => m.TalentSurveysComponent),
  },
  {
    path: 'surveys/:id',
    data: { breadcrumb: 'NAV.TALENT_LEARNING_SURVEY', title: 'PAGE_TITLE.TALENT_LEARNING_SURVEY' },
    loadComponent: () => import('./talent-survey-results.component').then((m) => m.TalentSurveyResultsComponent),
  },
];
