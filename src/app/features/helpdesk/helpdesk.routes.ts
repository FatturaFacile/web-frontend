import { Routes } from '@angular/router';
import { moduleGuard } from '@core';
import { ResourcePageComponent } from '@shared';
import { HELPDESK_AGENT_TOOLS_PAGE } from './agent-tools.page';
import { HELPDESK_AUTOMATION_PAGE } from './automation.page';
import { HELPDESK_REPORTS_PAGE } from './helpdesk-reports.page';
import { ITSM_PAGE } from './itsm.page';
import { KNOWLEDGE_BASE_PAGE } from './knowledge-base.page';
import { SERVICE_WORK_ORDERS_PAGE } from './service-delivery.page';

const helpdeskRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  canActivate: [moduleGuard('service', 'read')],
  data: { breadcrumb, title: breadcrumb, page },
  component: ResourcePageComponent,
});

export const HELPDESK_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'reports' },
  helpdeskRoute('reports', 'Helpdesk: report e notifiche', HELPDESK_REPORTS_PAGE),
  helpdeskRoute('tools', 'Helpdesk: strumenti agente', HELPDESK_AGENT_TOOLS_PAGE),
  helpdeskRoute('automation', 'Helpdesk: automazioni e caselle', HELPDESK_AUTOMATION_PAGE),
  helpdeskRoute('knowledge-base', 'Knowledge base', KNOWLEDGE_BASE_PAGE),
  helpdeskRoute('itsm', 'ITSM: incidenti, problemi, cambiamenti', ITSM_PAGE),
  helpdeskRoute('service-delivery', 'Interventi e contratti di servizio', SERVICE_WORK_ORDERS_PAGE),
];
