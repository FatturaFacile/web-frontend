import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

/** Vehicle inspections due, with the outcome recorded when they are completed. */
export const AUTOMOTIVE_INSPECTIONS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.AUTOMOTIVE_INSPECTIONS',
  tabs: [
    {
      id: 'due-list',
      titleKey: 'RES.P.inspections_due',
      module: 'automotive',
      list: {
        path: '/automotive/inspections/due-list',
        columns: [...cols('vehicle_id', 'type'), col('scheduled_date', 'date'), tagCol('result'), col('passed_date', 'date'), ...cols('certificate_number')],
      },
      rowActions: [
        act('POST', 'RES.A.complete_inspection', '/automotive/inspections/{id}/complete', {
          fields: [
            req(rf.select('result', ['passed', 'failed', 'conditional'])),
            rf.text('certificate_number'),
            rf.textarea('inspector_notes'),
          ],
        }),
      ],
    },
  ],
};
