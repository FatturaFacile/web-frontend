import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const INCIDENT_FIELDS = [
  req(rf.text('title')),
  rf.textarea('description'),
  rf.select('severity', ['low', 'medium', 'high', 'critical', 'catastrophic']),
  rf.select('impact', ['minor', 'moderate', 'significant', 'extensive']),
  rf.select('urgency', ['low', 'medium', 'high', 'immediate']),
  rf.uuid('service_category_id'),
  rf.uuid('affected_asset_id'),
];

const CHANGE_FIELDS = [
  req(rf.text('title')),
  rf.textarea('description'),
  rf.select('change_type', ['standard', 'normal', 'emergency']),
  rf.select('risk_level', ['low', 'medium', 'high', 'extreme']),
  rf.select('priority', PRIORITIES),
  rf.uuid('service_category_id'),
  rf.textarea('rollout_plan'),
  rf.textarea('rollback_plan'),
  rf.textarea('test_plan'),
];

const isOpenIncident = (row: Record<string, unknown>): boolean => !['resolved', 'closed'].includes(String(row['status']));

/** ITSM: incidents, problem records and change requests with CAB approval. */
export const ITSM_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ITSM',
  tabs: [
    {
      id: 'incidents',
      titleKey: 'RES.P.incidents',
      module: 'service',
      list: {
        path: '/esm/incidents',
        columns: [
          ...cols('incident_number', 'title'),
          tagCol('severity'),
          tagCol('status'),
          col('is_major_incident', 'bool'),
          col('created_at', 'datetime'),
        ],
      },
      create: act('POST', 'RES.A.new_incident', '/esm/incidents', { fields: INCIDENT_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.resolve_incident', '/esm/incidents/{id}/resolve', {
          fields: [rf.textarea('resolution_summary')],
          visible: isOpenIncident,
        }),
      ],
    },
    {
      id: 'problems',
      titleKey: 'RES.P.problems',
      module: 'service',
      list: {
        path: '/esm/problems',
        columns: [
          ...cols('problem_number', 'title'),
          tagCol('status'),
          col('is_known_error', 'bool'),
          col('created_at', 'datetime'),
        ],
      },
    },
    {
      id: 'changes',
      titleKey: 'RES.P.changes',
      module: 'service',
      list: {
        path: '/esm/changes',
        columns: [
          ...cols('change_number', 'title'),
          tagCol('change_type'),
          tagCol('risk_level'),
          tagCol('priority'),
          tagCol('status'),
          col('cab_approved_at', 'datetime'),
        ],
      },
      create: act('POST', 'RES.A.new_change', '/esm/changes', { fields: CHANGE_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.approve_change', '/esm/changes/{id}/approve', {
          confirm: true,
          visible: (row) => !row['cab_approved_at'],
        }),
      ],
    },
  ],
};
