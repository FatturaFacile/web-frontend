import { Routes } from '@angular/router';
import { moduleGuard } from '@core';
import { HELPDESK_AGENT_TOOLS_PAGE } from './agent-tools.page';
import { HELPDESK_AUTOMATION_PAGE } from './automation.page';
import { HELPDESK_REPORTS_PAGE } from './helpdesk-reports.page';
import { HELPDESK_SLA_ADMIN_PAGE } from './helpdesk-sla-admin.page';
import { ITSM_PAGE } from './itsm.page';
import { KNOWLEDGE_BASE_PAGE } from './knowledge-base.page';
import { SERVICE_WORK_ORDERS_PAGE } from './service-delivery.page';

const helpdeskRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  canActivate: [moduleGuard('service', 'read')],
  data: { breadcrumb, title: breadcrumb, page },
  loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
});

export const HELPDESK_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'reports' },
  {
    path: 'sla',
    canActivate: [moduleGuard('service', 'read')],
    data: { breadcrumb: 'NAV.HD_SLA', title: 'NAV.HD_SLA' },
    loadComponent: () => import('./sla/helpdesk-sla.page').then((m) => m.HelpdeskSlaPageComponent),
  },
  helpdeskRoute('sla-admin', 'NAV.HD_SLA_ADMIN', HELPDESK_SLA_ADMIN_PAGE),
  helpdeskRoute('reports', 'Helpdesk: report e notifiche', HELPDESK_REPORTS_PAGE),
  helpdeskRoute('tools', 'Helpdesk: strumenti agente', HELPDESK_AGENT_TOOLS_PAGE),
  helpdeskRoute('automation', 'Helpdesk: automazioni e caselle', HELPDESK_AUTOMATION_PAGE),
  helpdeskRoute('knowledge-base', 'Knowledge base', KNOWLEDGE_BASE_PAGE),
  helpdeskRoute('itsm', 'ITSM: incidenti, problemi, cambiamenti', ITSM_PAGE),
  helpdeskRoute('service-delivery', 'Interventi e contratti di servizio', SERVICE_WORK_ORDERS_PAGE),
];
