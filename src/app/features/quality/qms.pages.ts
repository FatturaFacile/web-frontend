import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const NC_SOURCES = ['supplier', 'customer_complaint', 'internal', 'audit', 'manufacturing'] as const;
const SEVERITIES = ['minor', 'major', 'critical'] as const;
const NC_OPEN = ['open', 'investigating', 'capa_in_progress'] as const;
const AUDIT_TYPES = ['internal', 'process', 'supplier'] as const;
const CHECKLIST_RESULTS = ['pending', 'conforming', 'nonconforming', 'observation', 'not_applicable'] as const;
const FINDING_CLASSES = ['major_nc', 'minor_nc', 'observation', 'opportunity'] as const;

/** Non-conformities: raised, investigated with a root cause, linked to CAPA actions and closed. */
export const QUALITY_NONCONFORMITIES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.QUALITY_NONCONFORMITIES',
  tabs: [
    {
      id: 'nonconformities',
      titleKey: 'RES.P.qms_nonconformities',
      module: 'quality',
      list: {
        path: '/quality/nonconformities',
        filters: [
          rf.select('status', ['open', 'investigating', 'capa_in_progress', 'closed', 'cancelled']),
          rf.select('source', NC_SOURCES),
          rf.select('severity', SEVERITIES),
        ],
        columns: [...cols('number', 'title'), tagCol('source'), tagCol('severity'), tagCol('status'), col('detected_at', 'date')],
      },
      detailPath: '/quality/nonconformities/{id}',
      create: act('POST', 'RES.A.raise_nonconformity', '/quality/nonconformities', {
        fields: [
          req(rf.text('title', { maxLength: 190 })),
          rf.textarea('description', { maxLength: 4000 }),
          req(rf.select('source', NC_SOURCES)),
          rf.select('severity', SEVERITIES),
          rf.date('detected_at'),
          rf.uuid('owner_id'),
          rf.lookup('contact_id', 'contacts'),
          rf.textarea('containment_action', { maxLength: 4000 }),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_nonconformity', '/quality/nonconformities/{id}', {
          fields: [
            rf.text('title', { maxLength: 190 }),
            rf.textarea('description', { maxLength: 4000 }),
            rf.select('severity', SEVERITIES),
            rf.uuid('owner_id'),
            rf.textarea('containment_action', { maxLength: 4000 }),
            rf.textarea('root_cause', { maxLength: 4000 }),
          ],
          prefill: true,
          visible: whenIn('status', ...NC_OPEN),
        }),
        act('POST', 'RES.A.investigate_nonconformity', '/quality/nonconformities/{id}/investigate', {
          fields: [rf.uuid('owner_id')],
          visible: whenIn('status', 'open'),
        }),
        act('POST', 'RES.A.close_nonconformity', '/quality/nonconformities/{id}/close', {
          fields: [rf.textarea('closure_notes', { maxLength: 4000 })],
          visible: whenIn('status', ...NC_OPEN),
        }),
        act('POST', 'RES.A.cancel_nonconformity', '/quality/nonconformities/{id}/cancel', {
          fields: [req(rf.textarea('reason', { maxLength: 2000 }))],
          danger: true,
          visible: whenIn('status', 'open'),
        }),
      ],
    },
  ],
};

/** Corrective and preventive actions: started, completed and checked for effectiveness. */
export const QUALITY_CAPA_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.QUALITY_CAPA',
  tabs: [
    {
      id: 'capa-actions',
      titleKey: 'RES.P.qms_capa_actions',
      module: 'quality',
      list: {
        path: '/quality/capa-actions',
        filters: [
          rf.select('status', ['open', 'in_progress', 'completed', 'verified', 'ineffective', 'cancelled']),
          rf.select('type', ['corrective', 'preventive']),
        ],
        columns: [...cols('number', 'title'), tagCol('type'), tagCol('status'), col('due_date', 'date'), col('is_overdue', 'bool')],
      },
      detailPath: '/quality/capa-actions/{id}',
      create: act('POST', 'RES.A.new_capa_action', '/quality/capa-actions', {
        fields: [
          rf.uuid('nonconformity_id'),
          rf.select('type', ['corrective', 'preventive']),
          req(rf.text('title', { maxLength: 190 })),
          rf.textarea('description', { maxLength: 4000 }),
          req(rf.uuid('owner_id')),
          req(rf.date('due_date')),
          rf.date('effectiveness_check_due_date', { notBefore: 'due_date' }),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_capa_action', '/quality/capa-actions/{id}', {
          fields: [
            rf.text('title', { maxLength: 190 }),
            rf.textarea('description', { maxLength: 4000 }),
            rf.uuid('owner_id'),
            rf.date('due_date'),
            rf.date('effectiveness_check_due_date'),
          ],
          prefill: true,
          visible: whenIn('status', 'open', 'in_progress'),
        }),
        act('POST', 'RES.A.start_capa_action', '/quality/capa-actions/{id}/start', { visible: whenIn('status', 'open') }),
        act('POST', 'RES.A.complete_capa_action', '/quality/capa-actions/{id}/complete', {
          fields: [rf.date('effectiveness_check_due_date')],
          visible: whenIn('status', 'open', 'in_progress'),
        }),
        act('POST', 'RES.A.verify_capa_effectiveness', '/quality/capa-actions/{id}/verify-effectiveness', {
          fields: [req(rf.select('result', ['effective', 'not_effective'])), rf.textarea('notes', { maxLength: 4000 })],
          visible: whenIn('status', 'completed'),
        }),
        act('POST', 'RES.A.cancel_capa_action', '/quality/capa-actions/{id}/cancel', {
          confirm: true,
          danger: true,
          visible: whenIn('status', 'open', 'in_progress', 'completed', 'ineffective'),
        }),
      ],
    },
  ],
};

/** Audits with checklist results and findings, and the controlled procedures they check. */
export const QUALITY_AUDITS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.QUALITY_AUDITS',
  tabs: [
    {
      id: 'audits',
      titleKey: 'RES.P.qms_audits',
      module: 'quality',
      list: {
        path: '/quality/audits',
        filters: [rf.select('status', ['planned', 'in_progress', 'completed', 'cancelled']), rf.select('audit_type', AUDIT_TYPES)],
        columns: [...cols('number', 'title'), tagCol('audit_type'), tagCol('status'), col('planned_date', 'date'), col('performed_date', 'date'), ...cols('auditee')],
      },
      detailPath: '/quality/audits/{id}',
      create: act('POST', 'RES.A.plan_audit', '/quality/audits', {
        fields: [
          req(rf.text('title', { maxLength: 190 })),
          rf.textarea('scope', { maxLength: 4000 }),
          rf.select('audit_type', AUDIT_TYPES),
          req(rf.date('planned_date')),
          rf.uuid('lead_auditor_id'),
          rf.text('auditee', { maxLength: 190 }),
          rf.lines('checklist', [rf.text('clause', { maxLength: 60 }), req(rf.textarea('requirement', { maxLength: 2000 }))]),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_audit', '/quality/audits/{id}', {
          fields: [
            rf.text('title', { maxLength: 190 }),
            rf.textarea('scope', { maxLength: 4000 }),
            rf.select('audit_type', AUDIT_TYPES),
            rf.date('planned_date'),
            rf.uuid('lead_auditor_id'),
            rf.text('auditee', { maxLength: 190 }),
          ],
          prefill: true,
          visible: whenIn('status', 'planned'),
        }),
        act('POST', 'RES.A.start_audit', '/quality/audits/{id}/start', { visible: whenIn('status', 'planned') }),
        act('PUT', 'RES.A.record_checklist_result', '/quality/audits/{id}/checklist/{itemId}', {
          fields: [
            req(rf.uuid('itemId', { labelKey: 'RES.F.item_id' })),
            req(rf.select('result', CHECKLIST_RESULTS)),
            rf.textarea('notes', { maxLength: 4000 }),
          ],
          visible: whenIn('status', 'in_progress'),
        }),
        act('POST', 'RES.A.record_audit_finding', '/quality/audits/{id}/findings', {
          fields: [
            req(rf.select('classification', FINDING_CLASSES)),
            req(rf.textarea('description', { maxLength: 4000 })),
            rf.uuid('checklist_item_id'),
            rf.uuid('owner_id'),
          ],
          visible: whenIn('status', 'in_progress'),
        }),
        act('POST', 'RES.A.complete_audit', '/quality/audits/{id}/complete', {
          fields: [rf.textarea('summary', { maxLength: 4000 })],
          visible: whenIn('status', 'in_progress'),
        }),
        act('POST', 'RES.A.cancel_audit', '/quality/audits/{id}/cancel', {
          confirm: true,
          danger: true,
          visible: whenIn('status', 'planned', 'in_progress'),
        }),
      ],
    },
    {
      id: 'procedures',
      titleKey: 'RES.P.qms_procedures',
      module: 'quality',
      list: {
        path: '/quality/procedures',
        filters: [rf.select('status', ['draft', 'pending_approval', 'approved', 'rejected', 'obsolete'])],
        columns: [...cols('code', 'version', 'title'), tagCol('status'), col('effective_date', 'date'), col('review_due_date', 'date')],
      },
      detailPath: '/quality/procedures/{id}',
      create: act('POST', 'RES.A.new_procedure', '/quality/procedures', {
        fields: [
          req(rf.text('code', { maxLength: 40 })),
          req(rf.text('title', { maxLength: 190 })),
          rf.textarea('description', { maxLength: 4000 }),
          rf.uuid('document_id'),
          rf.uuid('owner_id'),
          rf.date('review_due_date'),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_procedure', '/quality/procedures/{id}', {
          fields: [
            rf.text('title', { maxLength: 190 }),
            rf.textarea('description', { maxLength: 4000 }),
            rf.uuid('document_id'),
            rf.uuid('owner_id'),
            rf.date('review_due_date'),
          ],
          prefill: true,
          visible: whenIn('status', 'draft', 'rejected'),
        }),
        act('POST', 'RES.A.submit_procedure', '/quality/procedures/{id}/submit', { visible: whenIn('status', 'draft', 'rejected') }),
        act('POST', 'RES.A.approve_procedure', '/quality/procedures/{id}/approve', { confirm: true, visible: whenIn('status', 'pending_approval') }),
        act('POST', 'RES.A.reject_procedure', '/quality/procedures/{id}/reject', {
          fields: [req(rf.textarea('reason', { maxLength: 2000 }))],
          danger: true,
          visible: whenIn('status', 'pending_approval'),
        }),
        act('POST', 'RES.A.revise_procedure', '/quality/procedures/{id}/revise', { visible: whenIn('status', 'approved') }),
        act('POST', 'RES.A.obsolete_procedure', '/quality/procedures/{id}/obsolete', { confirm: true, danger: true, visible: whenIn('status', 'approved') }),
      ],
    },
  ],
};
