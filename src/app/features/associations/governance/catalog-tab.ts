import { act, ResourceAction, ResourceColumn, ResourceField, ResourcePanelConfig } from '@shared';

/**
 * Tab over one catalog of the generic `/associations/catalogs/{catalog}` endpoints: list, create, edit and delete.
 * Translation keys derive from the catalog name (`RES.P.assoc_fee_plans`, `RES.A.assoc_new_fee_plans`).
 */
export function catalogTab(
  catalog: string,
  columns: readonly ResourceColumn[],
  fields: readonly ResourceField[],
  extraActions: readonly ResourceAction[] = [],
): ResourcePanelConfig {
  const slug = catalog.replace(/-/g, '_');
  return {
    id: catalog,
    titleKey: `RES.P.assoc_${slug}`,
    module: 'associations',
    detailPath: `/associations/catalogs/${catalog}/{id}`,
    list: { path: `/associations/catalogs/${catalog}`, columns },
    create: act('POST', `RES.A.assoc_new_${slug}`, `/associations/catalogs/${catalog}`, { fields }),
    rowActions: [
      ...extraActions,
      act('PUT', 'RES.ACTION.EDIT', `/associations/catalogs/${catalog}/{id}`, { prefill: true, fields }),
      act('DELETE', 'RES.ACTION.DELETE', `/associations/catalogs/${catalog}/{id}`, { confirm: true, danger: true }),
    ],
  };
}
