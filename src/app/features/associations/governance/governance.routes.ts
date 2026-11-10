import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { ASSOCIATIONS_CATALOGS_PAGE, ASSOCIATIONS_FUNDRAISING_CATALOGS_PAGE, ASSOCIATIONS_WORK_CATALOGS_PAGE } from './catalogs.page';
import { ASSOCIATIONS_COMPLIANCE_PAGE, ASSOCIATIONS_NETWORK_PAGE } from './compliance.page';
import { ASSOCIATIONS_MEETINGS_PAGE } from './meetings.page';
import { ASSOCIATIONS_PRIVACY_PAGE } from './privacy.page';
import { ASSOCIATIONS_STATEMENTS_PAGE } from './statements.page';

const governanceRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  data: { breadcrumb, title: breadcrumb, page },
  component: ResourcePageComponent,
});

/** Governance and compliance of associations: meetings, privacy, statements, legal books, network and catalogs. */
export const ASSOCIATIONS_GOVERNANCE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'meetings' },
  governanceRoute('meetings', 'Assemblee e verbali', ASSOCIATIONS_MEETINGS_PAGE),
  governanceRoute('privacy', 'Privacy (GDPR)', ASSOCIATIONS_PRIVACY_PAGE),
  governanceRoute('statements', 'Bilancio ETS', ASSOCIATIONS_STATEMENTS_PAGE),
  governanceRoute('compliance', 'Libri, 5 per mille e regime 398', ASSOCIATIONS_COMPLIANCE_PAGE),
  governanceRoute('network', 'Rete di affiliazione', ASSOCIATIONS_NETWORK_PAGE),
  governanceRoute('catalogs', 'Anagrafiche di configurazione', ASSOCIATIONS_CATALOGS_PAGE),
  governanceRoute('work-catalogs', 'Volontari, turni e collaboratori', ASSOCIATIONS_WORK_CATALOGS_PAGE),
  governanceRoute('fundraising-catalogs', 'Campagne, donatori e sponsor', ASSOCIATIONS_FUNDRAISING_CATALOGS_PAGE),
];
