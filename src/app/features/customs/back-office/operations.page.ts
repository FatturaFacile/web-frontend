import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const CHARGE_CATEGORIES = ['freight', 'handling', 'duty', 'import_vat', 'insurance', 'other'] as const;

/** Dossier work (charges, documents, deliveries, quotes), consolidations, tariff grids, discounts and tariff history. */
export const CUSTOMS_OPERATIONS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CUSTOMS_OPERATIONS',
  tabs: [
    {
      id: 'dossiers',
      titleKey: 'RES.P.customs_dossiers',
      module: 'customs',
      list: {
        path: '/customs/dossiers',
        filters: [rf.text('search'), rf.text('status')],
        columns: [...cols('dossier_number', 'customer_name', 'service_type', 'direction'), tagCol('status')],
      },
      rowActions: [
        act('POST', 'RES.A.add_charge', '/customs/dossiers/{id}/charges', {
          fields: [
            req(rf.select('kind', ['cost', 'revenue'])),
            req(rf.select('category', CHARGE_CATEGORIES)),
            rf.bool('is_direct'),
            req(rf.text('description', { maxLength: 255 })),
            req(rf.decimal('amount')),
            rf.decimal('tax_rate'),
            rf.uuid('supplier_contact_id'),
          ],
        }),
        act('POST', 'RES.A.import_assessments', '/customs/dossiers/{id}/import-assessments', { confirm: true, showResult: true }),
        act('GET', 'RES.A.assessment_check', '/customs/dossiers/{id}/assessment-check', { showResult: true }),
        act('POST', 'RES.A.attach_document', '/customs/dossiers/{id}/documents', {
          fields: [req(rf.file('file')), req(rf.select('document_kind', ['invoice', 'delivery_note', 'loading_list', 'email', 'other']))],
        }),
        act('POST', 'RES.A.record_delivery', '/customs/dossiers/{id}/deliveries', {
          fields: [
            rf.uuid('delivery_note_id'),
            req(rf.integer('packages', { min: 1 })),
            rf.decimal('gross_weight_kg'),
            rf.date('delivered_on'),
            rf.text('recipient', { maxLength: 120 }),
          ],
        }),
        act('GET', 'RES.A.list_quotes', '/customs/dossiers/{id}/quotes', { showResult: true }),
        act('POST', 'RES.A.quote_from_grid', '/customs/dossiers/{id}/quotes/from-grid', { fields: [rf.uuid('tariff_grid_id')] }),
        act('POST', 'RES.A.quote_spot', '/customs/dossiers/{id}/quotes/spot', {
          fields: [
            rf.date('valid_until'),
            req(rf.lines('lines', [req(rf.text('description', { maxLength: 255 })), req(rf.decimal('quantity', { positive: true })), req(rf.decimal('unit_price'))], { required: true })),
          ],
        }),
      ],
      toolbar: [
        act('GET', 'RES.A.monthly_summary', '/customs/dossiers/monthly-summary', {
          fields: [req(rf.uuid('contact_id')), req(rf.integer('year', { min: 2000 })), req(rf.integer('month', { min: 1 }))],
          showResult: true,
        }),
        act('POST', 'RES.A.declaration_from_delivery_note', '/customs/declarations/from-delivery-note', {
          fields: [req(rf.uuid('delivery_note_id')), req(rf.select('declaration_type', ['import', 'export', 'transit']))],
          showResult: true,
        }),
        act('POST', 'RES.A.quote_status', '/customs/quotes/{id}/status', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.quote_id' })), req(rf.select('status', ['sent', 'accepted', 'rejected']))],
        }),
      ],
    },
    {
      id: 'consolidations',
      titleKey: 'RES.P.consolidations',
      module: 'customs',
      list: { path: '/customs/consolidations', columns: [...cols('reference', 'carrier_name', 'freight_cost', 'currency'), col('departure_on', 'date')] },
      create: act('POST', 'RES.A.new_consolidation', '/customs/consolidations', {
        fields: [
          req(rf.text('reference', { maxLength: 40 })),
          rf.text('carrier_name', { maxLength: 120 }),
          rf.date('departure_on'),
          req(rf.decimal('freight_cost')),
          req(rf.text('currency', { maxLength: 3 })),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.add_dossier', '/customs/consolidations/{id}/dossiers/{dossierId}', {
          fields: [req(rf.uuid('dossierId', { labelKey: 'RES.F.dossier_id' }))],
        }),
        act('POST', 'RES.A.allocate_freight', '/customs/consolidations/{id}/allocate', { confirm: true, showResult: true }),
      ],
    },
    {
      id: 'tariff-grids',
      titleKey: 'RES.P.tariff_grids',
      module: 'customs',
      detailPath: '/customs/tariff-grids/{id}',
      list: { path: '/customs/tariff-grids', columns: cols('name', 'currency') },
      rowActions: [
        act('POST', 'RES.A.add_rate', '/customs/tariff-grids/{id}/rates', {
          fields: [
            rf.text('destination_country', { maxLength: 2 }),
            rf.decimal('min_weight_kg', { min: 0 }),
            rf.decimal('max_weight_kg', { atLeastField: 'min_weight_kg' }),
            rf.decimal('min_volume_m3', { min: 0 }),
            rf.decimal('max_volume_m3', { atLeastField: 'min_volume_m3' }),
            req(rf.select('basis', ['flat', 'per_kg', 'per_m3'])),
            req(rf.decimal('rate', { min: 0 })),
            rf.decimal('minimum_charge', { min: 0 }),
          ],
        }),
        act('DELETE', 'RES.A.delete_rate', '/customs/tariff-grids/{id}/rates/{rateId}', {
          fields: [req(rf.uuid('rateId', { labelKey: 'RES.F.rate_id' }))],
          danger: true,
        }),
      ],
    },
    {
      id: 'service-discounts',
      titleKey: 'RES.P.service_discounts',
      module: 'customs',
      list: { path: '/customs/service-discounts', columns: cols('contact_id', 'service_type', 'discount_percent') },
      create: act('PUT', 'RES.A.set_discount', '/customs/service-discounts', {
        fields: [req(rf.uuid('contact_id')), req(rf.text('service_type', { maxLength: 40 })), req(rf.decimal('discount_percent'))],
      }),
    },
    {
      id: 'tariff-history',
      titleKey: 'RES.P.tariff_history',
      module: 'customs',
      list: {
        path: '/customs/tariff-history',
        filters: [rf.text('search'), rf.text('commodity_code'), rf.text('origin_country'), rf.uuid('consignee_contact_id')],
        columns: [...cols('line_number', 'description', 'commodity_code', 'origin_country', 'duty_rate'), col('created_at', 'datetime')],
      },
      rowActions: [
        act('POST', 'RES.A.reuse_line', '/customs/declarations/{declarationId}/items/reuse/{itemId}', {
          fields: [req(rf.uuid('declarationId', { labelKey: 'RES.F.declaration_id' }))],
        }),
      ],
    },
  ],
};
