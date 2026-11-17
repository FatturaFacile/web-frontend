import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const VISIBILITY = ['private', 'company'] as const;

/** Properties of saved queries and dashboards (rename, visibility), scheduled runs, datasets, measures and snapshots. */
export const BI_LIBRARY_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.BI_LIBRARY',
  tabs: [
    {
      id: 'saved-queries',
      titleKey: 'RES.P.bi_saved_queries',
      module: 'business_intelligence',
      list: {
        path: '/business-intelligence/saved-queries',
        filters: [rf.text('dataset'), rf.text('search')],
        columns: [...cols('name', 'dataset', 'owner_name'), tagCol('visibility'), tagCol('snapshot_frequency'), col('next_snapshot_on', 'date')],
      },
      rowActions: [
        act('GET', 'RES.A.bi_run_query', '/business-intelligence/saved-queries/{id}/run', { showResult: true }),
        act('PUT', 'RES.ACTION.EDIT', '/business-intelligence/saved-queries/{id}', {
          prefill: true,
          fields: [
            req(rf.text('name', { maxLength: 150 })),
            rf.textarea('description', { maxLength: 1000 }),
            rf.select('visibility', VISIBILITY),
            rf.select('snapshot_frequency', ['daily', 'weekly', 'monthly']),
          ],
          visible: (row) => row['can_edit'] !== false,
        }),
        act('GET', 'RES.A.bi_view_snapshot', '/business-intelligence/snapshots/{snapshot_id}', {
          fields: [req(rf.uuid('snapshot_id'))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'dashboards',
      titleKey: 'RES.P.bi_dashboards',
      module: 'business_intelligence',
      list: {
        path: '/business-intelligence/dashboards',
        filters: [rf.text('search')],
        columns: [...cols('name', 'owner_name'), tagCol('visibility'), col('updated_at', 'datetime')],
      },
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/business-intelligence/dashboards/{id}', {
          prefill: true,
          fields: [
            req(rf.text('name', { maxLength: 150 })),
            rf.textarea('description', { maxLength: 1000 }),
            rf.select('visibility', VISIBILITY),
          ],
          visible: (row) => row['can_edit'] !== false,
        }),
      ],
    },
    {
      id: 'datasets',
      titleKey: 'RES.P.bi_datasets',
      module: 'business_intelligence',
      list: { path: '/business-intelligence/datasets', columns: [...cols('key', 'label', 'module', 'description')] },
      detailPath: '/business-intelligence/datasets/{key}',
    },
    {
      id: 'calculated-measures',
      titleKey: 'RES.P.bi_calculated_measures',
      module: 'business_intelligence',
      list: {
        path: '/business-intelligence/calculated-measures',
        columns: [...cols('dataset', 'key', 'label', 'formula'), tagCol('unit')],
      },
      detailPath: '/business-intelligence/calculated-measures/{id}',
    },
  ],
};
