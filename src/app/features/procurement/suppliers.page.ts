import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const QUALIFICATION_STATUSES = ['prospect', 'in_qualification', 'qualified', 'conditional', 'expired', 'disqualified'] as const;
const RATINGS = ['A', 'B', 'C', 'D'] as const;
const PERIOD_FILTERS = [rf.date('from'), rf.date('to'), rf.select('dimension', ['supplier', 'category', 'cost_center'])];

const SUPPLIER_FIELDS = [
  req(rf.text('supplier_code')),
  req(rf.text('company_name')),
  rf.text('vat_number'),
  rf.text('fiscal_code'),
  rf.uuid('supplier_category_id'),
  rf.uuid('contact_id'),
  rf.text('currency', { maxLength: 3 }),
  rf.text('payment_terms_code'),
  rf.text('incoterms'),
  rf.decimal('credit_limit'),
  rf.select('rating', RATINGS),
  rf.bool('is_approved_vendor'),
];

const EVALUATION_FIELDS = [
  req(rf.datetime('evaluation_period_start')),
  req(rf.datetime('evaluation_period_end')),
  req(rf.decimal('on_time_delivery_rate')),
  req(rf.decimal('quality_acceptance_rate')),
  req(rf.decimal('price_competitiveness_score')),
  req(rf.select('overall_rating', RATINGS)),
  req(rf.bool('is_approved_vendor')),
  rf.textarea('comments'),
];

const SUPPLIER_ID = req(rf.uuid('supplierId', { labelKey: 'RES.F.supplier_id' }));

/** Suppliers, qualification, documents, performance and evaluations. */
export const SUPPLIERS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SUPPLIERS',
  tabs: [
    {
      id: 'suppliers',
      titleKey: 'RES.P.suppliers',
      module: 'procurement',
      detailPath: '/procurement/suppliers/{id}',
      list: {
        path: '/procurement/suppliers',
        filters: [rf.uuid('category_id')],
        columns: [
          ...cols('supplier_code', 'company_name', 'vat_number'),
          tagCol('status'),
          tagCol('qualification_status'),
          tagCol('rating'),
          col('is_approved_vendor', 'bool'),
        ],
      },
      create: act('POST', 'RES.A.new_supplier', '/procurement/suppliers', { fields: SUPPLIER_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/procurement/suppliers/{id}', { prefill: true, fields: SUPPLIER_FIELDS }),
        act('PUT', 'RES.A.set_qualification', '/procurement/suppliers/{id}/qualification', {
          fields: [
            req(rf.select('qualification_status', QUALIFICATION_STATUSES)),
            rf.date('review_date'),
            rf.decimal('over_receipt_tolerance_percent'),
            rf.decimal('price_tolerance_percent'),
            rf.textarea('notes'),
          ],
        }),
        act('GET', 'RES.A.documents', '/procurement/suppliers/{id}/documents', { showResult: true }),
        act('POST', 'RES.A.add_document', '/procurement/suppliers/{id}/documents', {
          fields: [
            req(rf.text('document_type')),
            rf.text('reference'),
            rf.date('issued_at'),
            rf.date('expires_at'),
            rf.bool('is_mandatory'),
            rf.textarea('notes'),
          ],
        }),
        act('GET', 'RES.A.performance', '/procurement/suppliers/{id}/performance', { fields: PERIOD_FILTERS, showResult: true }),
        act('POST', 'RES.A.compute_evaluation', '/procurement/suppliers/{id}/evaluations/compute', {
          fields: [...PERIOD_FILTERS, rf.textarea('comments')],
          showResult: true,
        }),
        act('GET', 'RES.A.scorecard', '/procurement/suppliers/{supplierId}/scorecard', { showResult: true }),
        act('POST', 'RES.A.record_evaluation', '/procurement/suppliers/{supplierId}/evaluations', { fields: EVALUATION_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/procurement/suppliers/{id}', { confirm: true, danger: true }),
      ],
      toolbar: [
        act('POST', 'RES.A.expire_qualifications', '/procurement/supplier-qualifications/expire', { confirm: true, showResult: true }),
      ],
    },
    {
      id: 'supplier-documents',
      titleKey: 'RES.P.expiring_documents',
      module: 'procurement',
      list: { path: '/procurement/supplier-documents/expiring', filters: [rf.integer('days', { min: 1 })], columns: [...cols('supplier_id', 'document_type', 'reference'), col('expires_at', 'date'), col('is_mandatory', 'bool')] },
      rowActions: [act('DELETE', 'RES.ACTION.DELETE', '/procurement/supplier-documents/{id}', { confirm: true, danger: true })],
    },
    {
      id: 'evaluations',
      titleKey: 'RES.P.evaluations',
      module: 'procurement',
      list: {
        path: '/procurement/evaluations',
        filters: [rf.lookup('supplier_id', 'suppliers')],
        columns: [
          col('supplier_id'),
          col('evaluation_period_start', 'date'),
          col('evaluation_period_end', 'date'),
          ...cols('on_time_delivery_rate', 'quality_acceptance_rate', 'price_competitiveness_score'),
          tagCol('overall_rating'),
          col('is_approved_vendor', 'bool'),
        ],
      },
      toolbar: [
        act('POST', 'RES.A.record_evaluation', '/procurement/suppliers/{supplierId}/evaluations', {
          fields: [SUPPLIER_ID, ...EVALUATION_FIELDS],
        }),
      ],
    },
  ],
};
