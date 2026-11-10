import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

/** Assessment decisions (eVV): daily control list, statistics, retrieval runs, integrity, ledger posting and reconciliation. */
export const CUSTOMS_ASSESSMENTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CUSTOMS_ASSESSMENTS',
  tabs: [
    {
      id: 'control-list',
      titleKey: 'RES.P.assessment_control_list',
      module: 'customs',
      list: { path: '/customs/assessment-decisions/control-list', report: true, filters: [rf.date('date')], columns: [] },
    },
    {
      id: 'statistics',
      titleKey: 'RES.P.assessment_statistics',
      module: 'customs',
      list: {
        path: '/customs/assessment-decisions/statistics',
        report: true,
        manual: true,
        filters: [req(rf.date('date_from')), req(rf.date('date_to'))],
        columns: [],
      },
    },
    {
      id: 'decisions',
      titleKey: 'RES.P.assessment_decisions',
      module: 'customs',
      list: {
        path: '/customs/assessment-decisions',
        filters: [rf.text('mrn'), rf.text('document_type')],
        columns: [...cols('mrn', 'version', 'document_type', 'direction', 'duty_amount', 'vat_amount'), tagCol('status')],
      },
      rowActions: [
        act('GET', 'RES.A.check_integrity', '/customs/assessment-decisions/{id}/integrity', { showResult: true }),
        act('GET', 'RES.A.download_xml', '/customs/assessment-decisions/{id}/xml', { download: true }),
        act('POST', 'RES.A.post_to_ledger', '/customs/assessment-decisions/{id}/post', { confirm: true, showResult: true }),
      ],
    },
    {
      id: 'retrieval-runs',
      titleKey: 'RES.P.retrieval_runs',
      module: 'customs',
      list: {
        path: '/customs/assessment-decisions/retrieval-runs',
        columns: [...cols('gateway', 'listed_count', 'stored_count', 'duplicate_count', 'failed_count'), tagCol('status'), col('started_at', 'datetime'), col('finished_at', 'datetime')],
      },
    },
    {
      id: 'reconciliation',
      titleKey: 'RES.P.ledger_reconciliation',
      module: 'customs',
      list: {
        path: '/customs/ledger/reconciliation',
        report: true,
        manual: true,
        filters: [req(rf.date('date_from')), req(rf.date('date_to'))],
        columns: [],
      },
    },
    {
      id: 'declarations',
      titleKey: 'RES.P.customs_declarations',
      module: 'customs',
      list: {
        path: '/customs/declarations',
        columns: [...cols('declaration_type', 'mrn'), tagCol('status'), col('created_at', 'datetime')],
      },
      rowActions: [act('GET', 'RES.A.download_message', '/customs/declarations/{id}/message', { download: true })],
    },
  ],
};
