import { Component, computed, inject } from '@angular/core';
import { CorporateGroupApiService, PermissionsService } from '@core';
import { HubPageComponent } from '../../../resource-hub/hub-page.component';
import { f, HubTab, rows } from '../../../resource-hub/hub.types';

/** Multi-company corporate group hierarchy, operational sites, intercompany transactions and consolidation runs (#250). */
@Component({
  selector: 'app-corporate-group',
  imports: [HubPageComponent],
  template: `<app-hub-page
    title="CORPORATE_GROUP.TITLE"
    subtitle="CORPORATE_GROUP.SUBTITLE"
    [tabs]="tabs()"
  />`,
})
export class CorporateGroupComponent {
  private readonly api = inject(CorporateGroupApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly tabs = computed<HubTab[]>(() => {
    const canWrite = this.permissions.canWrite('system');
    return [
      {
        kind: 'crud',
        title: 'CORPORATE_GROUP.TAB_COMPANIES',
        config: {
          titleKey: 'CORPORATE_GROUP.TAB_COMPANIES',
          canWrite,
          list: () => rows(this.api.listCompanies()),
          create: (p) => this.api.createCompany(p),
          update: (id, p) => this.api.updateCompany(id, p),
          remove: (id) => this.api.deleteCompany(id),
          fields: [
            f.text('name', 'COMMON.NAME', { required: true, maxLength: 160 }),
            f.text('code', 'COMMON.CODE', { required: true, maxLength: 40 }),
            f.text('country', 'COMMON.COUNTRY', { required: true, maxLength: 2 }),
            f.text('currency', 'COMMON.CURRENCY', { required: true, maxLength: 3 }),
            f.text('vat_number', 'CRM.CLIENTS.FORM.VAT_NUMBER', { nullable: true, maxLength: 40 }),
          ],
        },
      },
      {
        kind: 'report',
        title: 'CORPORATE_GROUP.TAB_SITES',
        filters: [f.id('company_id', 'CORPORATE_GROUP.COMPANY_ID', { required: true })],
        load: (p) => this.api.listSites(String(p['company_id'])),
      },
      {
        kind: 'report',
        title: 'CORPORATE_GROUP.TAB_INTERCOMPANY',
        load: () => this.api.listIntercompanyTransactions(),
      },
      {
        kind: 'report',
        title: 'CORPORATE_GROUP.TAB_CONSOLIDATION',
        load: () => this.api.listConsolidationRuns(),
      },
    ];
  });
}
