import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

/** Documents of the DMS attached to the contracts of the register. */
export const CONTRACT_DOCUMENTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CONTRACT_DOCUMENTS',
  tabs: [
    {
      id: 'contract-documents',
      titleKey: 'RES.P.contract_documents',
      module: 'contracts',
      list: {
        path: '/contract-register',
        filters: [rf.text('search'), rf.select('kind', ['customer', 'supplier'])],
        columns: [...cols('contract_number', 'title', 'counterparty_name', 'kind'), tagCol('status'), col('end_date', 'date')],
      },
      rowActions: [
        act('GET', 'RES.A.view_contract_documents', '/contract-register/{kind}/{id}/documents', { showResult: true }),
        act('POST', 'RES.A.attach_contract_document', '/contract-register/{kind}/{id}/documents', {
          fields: [req(rf.uuid('document_id'))],
        }),
        act('DELETE', 'RES.A.detach_contract_document', '/contract-register/{kind}/{id}/documents/{documentId}', {
          fields: [req(rf.uuid('documentId', { labelKey: 'RES.F.document_id' }))],
          danger: true,
        }),
      ],
    },
  ],
};
