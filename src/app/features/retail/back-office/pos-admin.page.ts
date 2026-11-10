import { act, col, cols, ResourcePageConfig, ResourceRow, rf, req, tagCol, whenIn } from '@shared';

const PAYMENT_METHODS = ['cash', 'card', 'mixed', 'prepaid'] as const;

const hasPosSale = (row: ResourceRow): boolean => typeof row['pos_sale_id'] === 'string' && row['pos_sale_id'] !== '';

const SALE_ID = req(rf.uuid('saleId', { labelKey: 'RES.F.sale_id' }));

/** Till sessions and terminals, sale refund and fiscal printer transmission, commercial documents and the corrispettivi register. */
export const RETAIL_POS_ADMIN_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.RETAIL_POS_ADMIN',
  tabs: [
    {
      id: 'sessions',
      titleKey: 'RES.P.pos_sessions',
      module: 'fiscal_retail',
      list: { path: '/retail/pos/sessions', columns: [...cols('terminal_id', 'opening_float', 'closing_cash'), tagCol('status'), col('opened_at', 'datetime'), col('closed_at', 'datetime')] },
      rowActions: [
        act('GET', 'RES.A.session_report', '/retail/pos/sessions/{id}/report', { showResult: true }),
        act('POST', 'RES.A.close_session', '/retail/pos/sessions/{id}/close', {
          fields: [req(rf.decimal('closing_cash'))],
          visible: whenIn('status', 'open'),
          showResult: true,
        }),
      ],
    },
    {
      id: 'terminals',
      titleKey: 'RES.P.pos_terminals',
      module: 'fiscal_retail',
      list: { path: '/retail/pos/terminals', columns: [...cols('terminal_code', 'name', 'hardware_serial', 'rt_serial_number'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_terminal', '/retail/pos/terminals', {
        fields: [
          req(rf.text('terminal_code', { maxLength: 40 })),
          req(rf.text('name', { maxLength: 120 })),
          rf.text('hardware_serial'),
          rf.text('rt_serial_number'),
          rf.bool('is_active', { defaultValue: true }),
        ],
      }),
    },
    {
      id: 'documents',
      titleKey: 'RES.P.commercial_documents',
      module: 'fiscal_retail',
      list: {
        path: '/fiscal-retail/commercial-documents',
        filters: [rf.text('document_type'), rf.text('gateway_status')],
        columns: [...cols('document_number', 'document_type', 'payment_method', 'total_gross'), tagCol('gateway_status'), col('issue_date', 'datetime')],
      },
      rowActions: [
        act('GET', 'RES.A.view_sale', '/retail/pos/sales/{pos_sale_id}', { visible: hasPosSale, showResult: true }),
        act('POST', 'RES.A.rt_transmit', '/retail/pos/sales/{pos_sale_id}/rt-transmit', { visible: hasPosSale, showResult: true }),
        act('POST', 'RES.A.refund_sale', '/retail/pos/sales/{pos_sale_id}/refund', { visible: hasPosSale, confirm: true, danger: true, showResult: true }),
        act('POST', 'RES.A.retransmit_document', '/fiscal-retail/commercial-documents/{id}/retransmit', { confirm: true, showResult: true }),
        act('POST', 'RES.A.return_document', '/fiscal-retail/commercial-documents/{id}/return', {
          fields: [rf.json('lines')],
          showResult: true,
        }),
      ],
      toolbar: [
        act('POST', 'RES.A.new_sale', '/retail/pos/sales', {
          showResult: true,
          fields: [
            req(rf.uuid('pos_session_id')),
            rf.uuid('contact_id'),
            rf.uuid('loyalty_card_id'),
            req(rf.select('payment_method', PAYMENT_METHODS)),
            rf.decimal('cash_amount'),
            rf.decimal('cash_tendered'),
            req(
              rf.lines(
                'items',
                [rf.uuid('product_id'), rf.text('description'), req(rf.decimal('quantity')), rf.decimal('unit_price'), rf.decimal('tax_rate'), rf.decimal('discount_percentage')],
                { required: true },
              ),
            ),
          ],
        }),
        act('GET', 'RES.A.find_sale', '/retail/pos/sales/{saleId}', { fields: [SALE_ID], showResult: true }),
        act('POST', 'RES.A.rt_transmit_sale', '/retail/pos/sales/{saleId}/rt-transmit', { fields: [SALE_ID], showResult: true }),
        act('POST', 'RES.A.refund_sale_by_id', '/retail/pos/sales/{saleId}/refund', { fields: [SALE_ID], showResult: true }),
      ],
    },
    {
      id: 'corrispettivi',
      titleKey: 'RES.P.corrispettivi_register',
      module: 'fiscal_retail',
      list: {
        path: '/fiscal-retail/corrispettivi/register',
        report: true,
        manual: true,
        filters: [req(rf.integer('year', { min: 2000 })), req(rf.integer('month', { min: 1 }))],
        columns: [],
      },
      toolbar: [
        act('POST', 'RES.A.close_day', '/fiscal-retail/corrispettivi/daily/{date}/close', {
          fields: [req(rf.date('date'))],
          showResult: true,
        }),
      ],
    },
  ],
};
