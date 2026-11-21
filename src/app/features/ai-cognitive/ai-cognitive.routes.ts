import { Routes } from '@angular/router';
import { moduleGuard } from '@core/auth/auth.guard';

/** `/ai/workbench` and `/ai/insights` (Mod 093); the provider settings live at `/settings/ai`. */
export const AI_COGNITIVE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'workbench' },
  {
    path: 'workbench',
    canActivate: [moduleGuard('ai_review', 'read')],
    data: { breadcrumb: 'AI_COG.WORKBENCH_TITLE', title: 'AI_COG.WORKBENCH_TITLE' },
    loadComponent: () =>
      import('./ai-workbench-page.component').then((m) => m.AiWorkbenchPageComponent),
  },
  {
    path: 'insights',
    canActivate: [moduleGuard('ai_review', 'read')],
    data: { breadcrumb: 'AI_COG.INSIGHTS_TITLE', title: 'AI_COG.INSIGHTS_TITLE' },
    loadComponent: () =>
      import('./ai-insights-page.component').then((m) => m.AiInsightsPageComponent),
  },
];
