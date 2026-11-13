import { act, col, cols, ResourceField, ResourcePageConfig, rf, req } from '@shared';

const MASTER_DATA_TYPES = ['tariff-numbers', 'statistical-keys', 'packaging-types', 'countries', 'document-types'] as const;

const MASTER_DATA_FIELDS: readonly ResourceField[] = [
  req(rf.text('code', { maxLength: 12 })),
  req(rf.text('tariff_code', { maxLength: 12, scopeValues: ['statistical-keys'] })),
  rf.text('name_de', { maxLength: 500 }),
  rf.text('name_fr', { maxLength: 500 }),
  rf.text('name_it', { maxLength: 500 }),
  rf.text('name_en', { maxLength: 500 }),
  rf.date('valid_from'),
  rf.date('valid_to', { notBefore: 'valid_from' }),
  rf.bool('is_active', { defaultValue: true }),
];

const SETTINGS_FIELDS: readonly ResourceField[] = [
  rf.select('channel', ['local', 'edec']),
  rf.bool('auto_retrieve'),
  rf.text('trader_identification_number', { maxLength: 17 }),
  rf.integer('declarant_number'),
  rf.text('declarant_name', { maxLength: 35 }),
  rf.text('declarant_street', { maxLength: 35 }),
  rf.text('declarant_postal_code', { maxLength: 9 }),
  rf.text('declarant_city', { maxLength: 35 }),
  rf.text('declarant_country'),
  rf.text('customs_account'),
  rf.text('vat_account'),
  rf.text('vat_number', { maxLength: 12 }),
  rf.select('receipt_role', ['0', '1', '2']),
  rf.uuid('duty_expense_account_id'),
  rf.uuid('customs_payable_account_id'),
  rf.uuid('import_vat_account_id'),
];

/** Customs settings and the code tables (tariff numbers, statistical keys, packaging types, countries, document types). */
export const CUSTOMS_SETUP_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CUSTOMS_SETUP',
  tabs: [
    {
      id: 'settings',
      titleKey: 'RES.P.customs_settings',
      module: 'customs',
      list: { path: '/customs/settings', report: true, columns: [] },
      toolbar: [act('PUT', 'RES.A.edit_settings', '/customs/settings', { fields: SETTINGS_FIELDS, prefill: true })],
    },
    {
      id: 'master-data',
      titleKey: 'RES.P.customs_master_data',
      module: 'customs',
      list: {
        path: '/customs/master-data/{type}',
        scope: req(rf.select('type', MASTER_DATA_TYPES)),
        columns: [...cols('code', 'tariff_code', 'name_it', 'name_en'), col('valid_from', 'date'), col('valid_to', 'date'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.add_code', '/customs/master-data/{type}', { fields: MASTER_DATA_FIELDS }),
      rowActions: [
        act('PUT', 'RES.A.edit_code', '/customs/master-data/{type}/{id}', { fields: MASTER_DATA_FIELDS, prefill: true }),
        act('DELETE', 'RES.A.delete_code', '/customs/master-data/{type}/{id}', { confirm: true, danger: true }),
      ],
    },
  ],
};
