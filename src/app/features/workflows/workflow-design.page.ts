import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const NODE_TYPES = ['start', 'approval', 'condition', 'notification', 'end'] as const;
const ESCALATE_TO = ['reporting_manager', 'specific_role', 'specific_user'] as const;

const DEFINITION_FIELDS = [
  req(rf.text('code', { maxLength: 60 })),
  req(rf.text('name', { maxLength: 150 })),
  rf.textarea('description', { maxLength: 1000 }),
  req(rf.text('target_entity_type', { maxLength: 100 })),
];

const NODE_FIELDS = [
  req(rf.text('node_key', { maxLength: 60 })),
  req(rf.text('name', { maxLength: 150 })),
  req(rf.select('node_type', NODE_TYPES)),
  rf.json('config'),
  rf.integer('position_x'),
  rf.integer('position_y'),
];

const TRANSITION_FIELDS = [
  req(rf.uuid('from_node_id')),
  req(rf.uuid('to_node_id', { differentFrom: 'from_node_id' })),
  rf.text('condition_expression', { maxLength: 500 }),
  rf.text('label', { maxLength: 100 }),
];

const ESCALATION_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  req(rf.integer('reminder_hours', { min: 0 })),
  req(rf.integer('escalation_hours', { min: 0 })),
  req(rf.select('escalate_to_type', ESCALATE_TO)),
  rf.uuid('escalate_to_id'),
  rf.text('auto_action', { maxLength: 60 }),
];

/** Workflow designer (nodes and transitions of a definition), the user's own requests and decision history. */
export const WORKFLOW_DESIGN_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.WORKFLOW_DESIGN',
  tabs: [
    {
      id: 'definitions',
      titleKey: 'RES.P.workflow_definitions',
      module: 'workflow_design',
      list: {
        path: '/workflows/definitions',
        columns: [...cols('code', 'name', 'target_entity_type'), col('version'), tagCol('status')],
      },
      detailPath: '/workflows/definitions/{id}',
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/workflows/definitions/{id}', { prefill: true, fields: DEFINITION_FIELDS }),
        act('POST', 'RES.A.workflow_add_node', '/workflows/definitions/{id}/nodes', { fields: NODE_FIELDS }),
        act('PUT', 'RES.A.workflow_edit_node', '/workflows/definitions/{id}/nodes/{node_id}', {
          fields: [req(rf.uuid('node_id')), ...NODE_FIELDS.map((field) => ({ ...field, required: false }))],
        }),
        act('DELETE', 'RES.A.workflow_delete_node', '/workflows/definitions/{id}/nodes/{node_id}', {
          fields: [req(rf.uuid('node_id'))],
          confirm: true,
          danger: true,
        }),
        act('POST', 'RES.A.workflow_add_transition', '/workflows/definitions/{id}/transitions', { fields: TRANSITION_FIELDS }),
        act('PUT', 'RES.A.workflow_edit_transition', '/workflows/definitions/{id}/transitions/{transition_id}', {
          fields: [req(rf.uuid('transition_id')), ...TRANSITION_FIELDS.map((field) => ({ ...field, required: false }))],
        }),
        act('DELETE', 'RES.A.workflow_delete_transition', '/workflows/definitions/{id}/transitions/{transition_id}', {
          fields: [req(rf.uuid('transition_id'))],
          confirm: true,
          danger: true,
        }),
      ],
    },
    {
      id: 'escalation-rules',
      titleKey: 'RES.P.workflow_escalation_rules',
      module: 'workflow_design',
      list: {
        path: '/workflows/escalation-rules',
        columns: [...cols('name'), col('reminder_hours'), col('escalation_hours'), tagCol('escalate_to_type')],
      },
      rowActions: [act('PUT', 'RES.ACTION.EDIT', '/workflows/escalation-rules/{id}', { prefill: true, fields: ESCALATION_FIELDS })],
    },
    {
      id: 'my-requests',
      titleKey: 'RES.P.workflow_my_requests',
      module: 'workflow',
      list: {
        path: '/workflows/my-requests',
        columns: [...cols('definition.name', 'approvable_type'), tagCol('status'), col('started_at', 'datetime'), col('completed_at', 'datetime')],
      },
      detailPath: '/workflows/instances/{id}',
    },
    {
      id: 'my-history',
      titleKey: 'RES.P.workflow_my_history',
      module: 'workflow',
      list: {
        path: '/workflows/my-history',
        columns: [...cols('workflow_name', 'approvable_label', 'step_name'), tagCol('decision'), col('decided_at', 'datetime')],
      },
    },
  ],
};
