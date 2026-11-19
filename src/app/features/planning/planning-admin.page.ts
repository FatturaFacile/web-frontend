import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

/** Scenario master data and the published plan versions. */
export const PLANNING_ADMIN_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PLANNING_ADMIN',
  tabs: [
    {
      id: 'scenarios',
      titleKey: 'RES.P.planning_scenarios',
      module: 'planning',
      list: {
        path: '/planning/scenarios',
        columns: [...cols('name'), tagCol('scenario_type'), tagCol('status'), col('horizon_start', 'date'), col('horizon_end', 'date')],
      },
      detailPath: '/planning/scenarios/{id}',
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/planning/scenarios/{id}', {
          prefill: true,
          fields: [
            req(rf.text('name', { maxLength: 150 })),
            rf.textarea('description', { maxLength: 1000 }),
            req(rf.select('scenario_type', ['baseline', 'what_if'])),
            req(rf.date('horizon_start')),
            req(rf.date('horizon_end', { notBefore: 'horizon_start', strictlyAfter: true })),
          ],
          visible: (row) => !['approved', 'locked', 'published'].includes(String(row['status'])),
        }),
      ],
    },
    {
      id: 'publications',
      titleKey: 'RES.P.planning_publications',
      module: 'planning',
      list: {
        path: '/planning/publications',
        filters: [rf.uuid('scenario_id')],
        columns: [...cols('scenario_id'), col('version'), col('is_current', 'bool'), col('published_at', 'datetime')],
      },
    },
    {
      id: 'resources',
      titleKey: 'RES.P.planning_resources',
      module: 'planning',
      list: {
        path: '/planning/resources',
        columns: [...cols('code', 'name', 'unit'), col('default_capacity', 'decimal'), col('is_active', 'bool')],
      },
      detailPath: '/planning/resources/{id}',
    },
  ],
};
