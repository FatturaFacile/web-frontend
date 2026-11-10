import { act, col, cols, ResourceField, ResourcePageConfig, ResourceRow, rf, req, tagCol, whenIn } from '@shared';

const SITE_STATUSES = ['planning', 'active', 'paused', 'completed'] as const;
const PRICE_SOURCES = ['own', 'npk', 'crb', 'asip', 'other'] as const;
const DESCRIPTIONS_TEMPLATE = '{"it":"","de":"","fr":"","en":""}';

/** Generic price lists are read-only. */
const isOwnRecord = (row: ResourceRow): boolean => row['is_generic'] !== true;

const SITE_FIELDS: readonly ResourceField[] = [
  req(rf.uuid('client_id')),
  req(rf.text('code', { maxLength: 40 })),
  req(rf.text('name', { maxLength: 190 })),
  req(rf.text('address', { maxLength: 255 })),
  rf.text('sia_norm_reference'),
  rf.text('npk_code'),
  rf.date('start_date'),
  rf.date('estimated_end_date'),
  rf.select('status', SITE_STATUSES),
];

const PRICE_LIST_FIELDS: readonly ResourceField[] = [
  req(rf.text('name', { maxLength: 190 })),
  req(rf.select('source', PRICE_SOURCES)),
  rf.text('edition'),
  rf.text('license_reference'),
  req(rf.text('currency', { maxLength: 3 })),
  req(rf.tags('languages')),
  rf.date('valid_from'),
  rf.date('valid_to'),
  rf.bool('is_active'),
];

const WORK_STEP_FIELDS: readonly ResourceField[] = [
  rf.uuid('price_item_id'),
  rf.json('descriptions', { defaultValue: DESCRIPTIONS_TEMPLATE }),
  rf.decimal('quantity_factor'),
  req(rf.decimal('unit_price')),
  rf.integer('labour_minutes', { min: 0 }),
  rf.decimal('material_cost'),
  rf.decimal('machine_cost'),
];

const SITE_SCOPE = req(rf.lookup('siteId', 'constructionSites'));

/** Construction sites and construction trades back office: price lists, work cycles, settlements, subcontracts and diary. */
export const CONSTRUCTION_TRADES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CONSTRUCTION_TRADES',
  tabs: [
    {
      id: 'sites',
      titleKey: 'RES.P.construction_sites',
      module: 'construction',
      detailPath: '/construction/sites/{id}',
      list: {
        path: '/construction/sites',
        columns: [...cols('code', 'name', 'address'), tagCol('status'), col('start_date', 'date'), col('estimated_end_date', 'date')],
      },
      rowActions: [
        act('PUT', 'RES.A.edit_site', '/construction/sites/{id}', { fields: SITE_FIELDS, prefill: true }),
        act('DELETE', 'RES.A.archive_site', '/construction/sites/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'conformity-certificates',
      titleKey: 'RES.P.conformity_certificates',
      module: 'construction',
      list: {
        path: '/construction/conformity-certificates',
        columns: [...cols('type', 'certificate_number', 'inspector_name', 'construction_site_id'), col('certified_at', 'datetime')],
      },
    },
    {
      id: 'price-lists',
      titleKey: 'RES.P.price_lists',
      module: 'construction_trades',
      detailPath: '/construction-trades/price-lists/{id}',
      list: {
        path: '/construction-trades/price-lists',
        columns: [...cols('name', 'source', 'edition', 'currency'), col('valid_from', 'date'), col('valid_to', 'date'), col('is_active', 'bool')],
      },
      rowActions: [
        act('PUT', 'RES.A.edit_price_list', '/construction-trades/price-lists/{id}', { fields: PRICE_LIST_FIELDS, prefill: true, visible: isOwnRecord }),
        act('POST', 'RES.A.add_position', '/construction-trades/price-lists/{id}/items', {
          visible: isOwnRecord,
          fields: [
            req(rf.text('position_code', { maxLength: 40 })),
            rf.text('parent_code', { maxLength: 40 }),
            req(rf.text('unit', { maxLength: 20 })),
            req(rf.decimal('unit_price')),
            rf.integer('labour_minutes', { min: 0 }),
            rf.decimal('material_cost'),
            rf.decimal('machine_cost'),
            req(rf.json('descriptions', { defaultValue: DESCRIPTIONS_TEMPLATE })),
          ],
        }),
        act('POST', 'RES.A.import_positions', '/construction-trades/price-lists/{id}/import', {
          visible: isOwnRecord,
          fields: [req(rf.file('file'))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'work-cycles',
      titleKey: 'RES.P.work_cycles',
      module: 'construction_trades',
      detailPath: '/construction-trades/work-cycles/{id}',
      list: { path: '/construction-trades/work-cycles', columns: [...cols('name', 'unit'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_work_cycle', '/construction-trades/work-cycles', {
        fields: [
          req(rf.text('name', { maxLength: 190 })),
          req(rf.text('unit', { maxLength: 20 })),
          req(rf.json('descriptions', { defaultValue: DESCRIPTIONS_TEMPLATE })),
          rf.bool('is_active', { defaultValue: true }),
          req(rf.lines('steps', WORK_STEP_FIELDS, { required: true })),
        ],
      }),
    },
    {
      id: 'bids',
      titleKey: 'RES.P.bids_settlement',
      module: 'construction_trades',
      list: { path: '/construction-trades/bids', columns: [...cols('bid_number', 'title'), tagCol('status')] },
      rowActions: [
        act('GET', 'RES.A.view_settlement', '/construction-trades/bids/{id}/settlement', { showResult: true }),
        act('POST', 'RES.A.approve_settlement', '/construction-trades/bids/{id}/settlement/approve', { confirm: true, showResult: true }),
        act('GET', 'RES.A.tender_specification', '/construction-trades/bids/{id}/tender-specification', {
          fields: [rf.bool('with_prices')],
          download: true,
        }),
      ],
    },
    {
      id: 'subcontractors',
      titleKey: 'RES.P.subcontractors',
      module: 'construction_trades',
      list: { path: '/construction-trades/subcontractors', columns: [...cols('name', 'tax_id', 'trade'), tagCol('status')] },
      rowActions: [
        act('PUT', 'RES.A.edit_subcontractor', '/construction-trades/subcontractors/{id}', {
          prefill: true,
          fields: [
            req(rf.text('name', { maxLength: 190 })),
            rf.uuid('contact_id'),
            rf.text('tax_id', { maxLength: 40 }),
            rf.text('trade', { maxLength: 100 }),
            rf.select('status', ['active', 'suspended']),
            rf.textarea('notes', { maxLength: 500 }),
          ],
        }),
      ],
    },
    {
      id: 'subcontracts',
      titleKey: 'RES.P.subcontracts',
      module: 'construction_trades',
      list: {
        path: '/construction-trades/sites/{siteId}/subcontracts',
        scope: SITE_SCOPE,
        columns: [...cols('description', 'contract_amount'), tagCol('status'), col('starts_on', 'date'), col('ends_on', 'date')],
      },
      rowActions: [
        act('POST', 'RES.A.close_subcontract', '/construction-trades/subcontracts/{id}/status', {
          fields: [req(rf.select('status', ['completed', 'cancelled']))],
          visible: whenIn('status', 'active'),
        }),
      ],
    },
    {
      id: 'diary',
      titleKey: 'RES.P.site_diary',
      module: 'construction_trades',
      list: {
        path: '/construction-trades/sites/{siteId}/diary',
        scope: SITE_SCOPE,
        columns: [...cols('weather', 'workers_present', 'work_performed', 'incidents'), col('entry_date', 'date')],
      },
      rowActions: [
        act('PUT', 'RES.A.correct_diary', '/construction-trades/diary/{id}', {
          prefill: true,
          fields: [
            rf.text('weather', { maxLength: 100 }),
            req(rf.integer('workers_present', { min: 0 })),
            req(rf.textarea('work_performed', { maxLength: 5000 })),
            rf.textarea('incidents', { maxLength: 5000 }),
          ],
        }),
      ],
    },
  ],
};
