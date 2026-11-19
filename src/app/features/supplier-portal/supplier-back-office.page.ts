import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const REQUIREMENT_FIELDS = [
  req(rf.text('code', { maxLength: 50 })),
  req(rf.text('name', { maxLength: 190 })),
  rf.select('country', ['IT', 'CH']),
  rf.bool('is_mandatory'),
  rf.bool('requires_expiry'),
  rf.integer('validity_days', { min: 1 }),
  rf.integer('alert_days', { min: 0 }),
  rf.bool('is_active'),
  rf.integer('sort_order', { min: 0 }),
];

/** Back office of the supplier portal: document requirements, qualification scoring, risk and bank change detail. */
export const SUPPLIER_BACK_OFFICE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SUPPLIER_BACK_OFFICE',
  tabs: [
    {
      id: 'document-requirements',
      titleKey: 'RES.P.document_requirements',
      module: 'supplier_portal',
      list: {
        path: '/supplier-portal/document-requirements',
        columns: [...cols('code', 'name', 'country'), col('is_mandatory', 'bool'), col('requires_expiry', 'bool'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_requirement', '/supplier-portal/document-requirements', { fields: REQUIREMENT_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/supplier-portal/document-requirements/{id}', { prefill: true, fields: REQUIREMENT_FIELDS }),
      ],
    },
    {
      id: 'qualification-assessments',
      titleKey: 'RES.P.qualification_assessments',
      module: 'supplier_portal',
      detailPath: '/supplier-portal/qualification-assessments/{id}',
      list: {
        path: '/supplier-portal/qualification-assessments',
        columns: [...cols('supplier_id'), tagCol('status'), ...cols('total_score', 'band'), tagCol('outcome')],
      },
      rowActions: [
        act('PUT', 'RES.A.record_scores', '/supplier-portal/qualification-assessments/{id}/scores', {
          fields: [
            rf.textarea('notes', { maxLength: 2000 }),
            req(
              rf.lines('scores', [req(rf.uuid('criterion_id')), req(rf.decimal('score', { min: 0 })), rf.text('notes', { maxLength: 500 })], {
                required: true,
              }),
            ),
          ],
          showResult: true,
          visible: whenIn('status', 'draft'),
        }),
      ],
    },
    {
      id: 'supplier-risk',
      titleKey: 'RES.P.supplier_risk',
      module: 'supplier_portal',
      list: {
        path: '/supplier-portal/risk',
        columns: [...cols('supplier_name'), tagCol('level'), ...cols('score'), col('evaluated_at', 'datetime')],
      },
      rowActions: [act('GET', 'RES.A.risk_detail', '/supplier-portal/suppliers/{supplier_id}/risk', { showResult: true })],
      toolbar: [act('POST', 'RES.A.recalculate_risk', '/supplier-portal/risk/recalculate', { confirm: true, showResult: true })],
    },
    {
      id: 'bank-change-details',
      titleKey: 'RES.P.bank_changes',
      module: 'supplier_portal',
      detailPath: '/supplier-portal/bank-changes/{id}',
      list: {
        path: '/supplier-portal/bank-changes',
        columns: [...cols('supplier_id'), tagCol('status'), col('created_at', 'datetime')],
      },
    },
  ],
};
