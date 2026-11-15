import { act, cols, ResourcePageConfig, rf, req } from '@shared';

/** Which accounts sit in a sales territory, and moving an account to another territory. */
export const TERRITORY_ACCOUNTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CRM_TERRITORY_ACCOUNTS',
  tabs: [
    {
      id: 'territory-accounts',
      titleKey: 'RES.P.crm_territory_accounts',
      module: 'crm',
      list: { path: '/crm/territories', columns: [...cols('code', 'name')] },
      rowActions: [
        act('GET', 'RES.A.crm_territory_accounts', '/crm/territories/{id}/accounts', { showResult: true }),
        act('POST', 'RES.A.crm_assign_account_territory', '/crm/accounts/{account_id}/territory', {
          fields: [req(rf.uuid('account_id')), req(rf.uuid('territory_id'))],
        }),
      ],
    },
  ],
};
