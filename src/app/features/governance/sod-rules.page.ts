import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

/** Segregation of duties on documents: how strictly each document type is enforced, and a role check. */
export const SOD_RULES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SOD_DOCUMENT_RULES',
  tabs: [
    {
      id: 'document-rules',
      titleKey: 'RES.P.sod_document_rules',
      module: 'governance',
      list: {
        path: '/governance/sod/document-rules',
        columns: [...cols('document_type'), tagCol('severity'), col('is_active', 'bool'), col('configured', 'bool')],
      },
      rowActions: [
        act('PUT', 'RES.A.sod_edit_document_rule', '/governance/sod/document-rules/{document_type}', {
          fields: [req(rf.select('severity', ['warn', 'block'])), req(rf.bool('is_active', { defaultValue: true }))],
          prefill: true,
        }),
      ],
      toolbar: [
        act('POST', 'RES.A.sod_check_role', '/governance/sod/check', {
          fields: [req(rf.text('role', { maxLength: 190 })), rf.tags('permissions')],
          showResult: true,
        }),
      ],
    },
  ],
};
