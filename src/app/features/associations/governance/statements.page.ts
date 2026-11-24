import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol, whenIn } from '@shared';
import { yearScope } from './scopes';

const SCHEMES = ['A', 'B', 'D'] as const;
const FILING_FORMS = ['ordinary', 'cash'] as const;


const MAPPING_FIELDS = [
  req(rf.select('scheme', SCHEMES)),
  req(rf.text('line_code', { maxLength: 40 })),
  req(rf.uuid('account_id')),
  rf.uuid('cost_center_id', { prohibitedIf: { field: 'scheme', value: 'A' } }),
  rf.bool('is_commercial'),
];

/** A year report: read-only key/value view loaded for the selected year. */
const reportTab = (id: string, path: string, extra: Partial<ResourcePanelConfig> = {}): ResourcePanelConfig => ({
  id,
  titleKey: `RES.P.assoc_${id.replace(/-/g, '_')}`,
  module: 'associations',
  list: { path, columns: [], report: true, scope: yearScope() },
  ...extra,
});

/** Third sector statements (ETS): account mappings, reports of the year, mission report and filings. */
export const ASSOCIATIONS_STATEMENTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_STATEMENTS',
  tabs: [
    {
      id: 'mappings',
      titleKey: 'RES.P.assoc_mappings',
      module: 'associations',
      list: {
        path: '/associations/statements/mappings',
        columns: [tagCol('scheme'), ...cols('line_code', 'account_id', 'cost_center_id'), col('is_commercial', 'bool')],
      },
      create: act('POST', 'RES.A.assoc_new_mapping', '/associations/statements/mappings', { fields: MAPPING_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/associations/statements/mappings/{id}', { prefill: true, fields: MAPPING_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/associations/statements/mappings/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'schemes',
      titleKey: 'RES.P.assoc_schemes',
      module: 'associations',
      list: { path: '/associations/statements/schemes', columns: [], report: true },
    },
    reportTab('checks', '/associations/statements/{year}/checks'),
    reportTab('management-report', '/associations/statements/{year}/management-report'),
    reportTab('balance-sheet', '/associations/statements/{year}/balance-sheet'),
    reportTab('cash-report', '/associations/statements/{year}/cash-report'),
    reportTab('mission-report', '/associations/statements/{year}/mission-report', {
      toolbar: [
        act('PUT', 'RES.A.assoc_save_mission_report', '/associations/statements/{year}/mission-report', {
          fields: [req(yearScope()), req(rf.json('answers'))],
        }),
      ],
    }),
    {
      id: 'filings',
      titleKey: 'RES.P.assoc_filings',
      module: 'associations',
      list: {
        path: '/associations/statements/filings',
        columns: [...cols('year'), tagCol('form'), tagCol('status'), col('filed_at', 'datetime'), ...cols('filing_reference')],
      },
      toolbar: [
        act('POST', 'RES.A.assoc_prepare_filing', '/associations/statements/{year}/filings', {
          fields: [req(yearScope()), req(rf.select('form', FILING_FORMS)), rf.text('reference', { maxLength: 255 })],
          showResult: true,
        }),
      ],
      rowActions: [
        act('POST', 'RES.A.assoc_mark_filed', '/associations/statement-filings/{id}/filed', {
          fields: [req(rf.text('reason', { labelKey: 'RES.F.filing_reference', maxLength: 500 }))],
          visible: whenIn('status', 'prepared'),
        }),
        act('GET', 'RES.A.assoc_filing_csv', '/associations/statement-filings/{id}/csv', { download: true }),
        act('GET', 'RES.A.assoc_filing_pdf', '/associations/statement-filings/{id}/pdf', { download: true }),
      ],
    },
  ],
};
