import { Routes } from '@angular/router';
import { placeholderRoutes } from '../placeholder';

export const ADVANCED_ROUTES: Routes = [
  {
    path: 'ai-assistant',
    loadComponent: () =>
      import('./ai-assistant/ai-assistant.component').then((m) => m.AiAssistantComponent),
    data: { breadcrumb: 'NAV.ADV_AI', title: 'NAV.ADV_AI' },
  },
  ...placeholderRoutes([
    ['security', 'NAV.ADV_SECURITY'],
    ['events-polls', 'NAV.ADV_EVENTS'],
    ['web-app', 'NAV.ADV_WEB_APP'],
  ]),
];
