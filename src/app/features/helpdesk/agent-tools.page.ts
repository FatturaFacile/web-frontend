import { act, col, cols, ResourcePageConfig, rf, req } from '@shared';

const CANNED_FIELDS = [
  req(rf.text('title', { maxLength: 150 })),
  rf.text('category', { maxLength: 80 }),
  req(rf.textarea('body', { maxLength: 20000 })),
  rf.bool('is_shared'),
];

const MACRO_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  rf.textarea('description', { maxLength: 1000 }),
  req(rf.json('actions', { labelKey: 'RES.F.macro_actions' })),
  rf.bool('is_shared'),
];

const VIEW_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  rf.integer('position', { min: 0 }),
  req(rf.json('filters', { labelKey: 'RES.F.view_filters' })),
  rf.bool('is_shared'),
];

/** Canned responses, macros and saved ticket views of the helpdesk agents. */
export const HELPDESK_AGENT_TOOLS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.HELPDESK_TOOLS',
  tabs: [
    {
      id: 'canned-responses',
      titleKey: 'RES.P.canned_responses',
      module: 'service',
      list: { path: '/esm/helpdesk/canned-responses', columns: [...cols('title', 'category'), col('is_shared', 'bool')] },
      create: act('POST', 'RES.A.new_canned_response', '/esm/helpdesk/canned-responses', { fields: CANNED_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/helpdesk/canned-responses/{id}', { prefill: true, fields: CANNED_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/helpdesk/canned-responses/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'macros',
      titleKey: 'RES.P.macros',
      module: 'service',
      list: { path: '/esm/helpdesk/macros', columns: [...cols('name', 'description'), col('is_shared', 'bool')] },
      create: act('POST', 'RES.A.new_macro', '/esm/helpdesk/macros', { fields: MACRO_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/helpdesk/macros/{id}', { prefill: true, fields: MACRO_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/helpdesk/macros/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'views',
      titleKey: 'RES.P.saved_views',
      module: 'service',
      list: { path: '/esm/helpdesk/views', columns: [...cols('name', 'position'), col('is_shared', 'bool')] },
      create: act('POST', 'RES.A.new_view', '/esm/helpdesk/views', { fields: VIEW_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/helpdesk/views/{id}', { prefill: true, fields: VIEW_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/helpdesk/views/{id}', { confirm: true, danger: true }),
      ],
    },
  ],
};
