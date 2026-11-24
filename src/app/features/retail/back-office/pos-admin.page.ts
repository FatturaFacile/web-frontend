import { act, col, cols, ResourceField, ResourcePageConfig, ResourceRow, rf, req, tagCol, whenIn } from '@shared';

const PAYMENT_METHODS = ['cash', 'card', 'mixed', 'prepaid'] as const;
const TICKET_PAYMENT_METHODS = ['cash', 'card', 'voucher', 'bank_transfer', 'mobile', 'other'] as const;
const PROMOTION_TYPES = ['percentage', 'fixed', 'buy_x_get_y'] as const;
const CASH_MOVEMENT_TYPES = ['pay_in', 'pay_out', 'safe_drop'] as const;
const REFUND_METHODS = ['cash', 'card', 'other'] as const;
const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'] as const;

/** Lines of a ticket or of an exchange: price and VAT default to the product master data. */
const ticketItems = (key: string): ResourceField =>
  req(
    rf.lines(
      key,
      [rf.uuid('product_id'), rf.text('description'), req(rf.decimal('quantity', { positive: true })), rf.decimal('unit_price', { min: 0 }), rf.decimal('tax_rate', { min: 0, max: 100 })],
      { required: true },
    ),
  );

/** Payments split by method: cash may exceed what is due (the excess is the change). */
const ticketPayments = (key: string): ResourceField =>
  rf.lines(key, [req(rf.select('method', TICKET_PAYMENT_METHODS)), req(rf.decimal('amount', { positive: true })), rf.text('reference', { maxLength: 120 })]);

/** Fields of a POS promotion; percentage and fixed need a value, buy X get Y a product and both quantities. */
const PROMOTION_FIELDS: readonly ResourceField[] = [
  req(rf.text('code', { maxLength: 40 })),
  req(rf.text('name', { maxLength: 190 })),
  req(rf.select('type', PROMOTION_TYPES)),
  rf.decimal('value', { positive: true }),
  rf.uuid('product_id'),
  rf.integer('buy_quantity', { min: 1 }),
  rf.integer('get_quantity', { min: 1 }),
  rf.decimal('min_subtotal', { min: 0 }),
  rf.datetime('starts_at'),
  rf.datetime('ends_at', { notBefore: 'starts_at' }),
  rf.multiselect('weekdays', WEEKDAYS),
  rf.time('time_from'),
  rf.time('time_to'),
  rf.integer('priority'),
  rf.bool('is_stackable', { defaultValue: false }),
  rf.bool('is_active', { defaultValue: true }),
];

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
        act('GET', 'RES.A.x_report', '/fiscal-retail/pos/sessions/{id}/x-report', { visible: whenIn('status', 'open'), showResult: true }),
        act('GET', 'RES.A.z_report', '/fiscal-retail/pos/sessions/{id}/z-report', { visible: whenIn('status', 'closed'), showResult: true }),
        act('GET', 'RES.A.cash_drawer', '/fiscal-retail/pos/sessions/{id}/cash-movements', { showResult: true }),
        act('POST', 'RES.A.record_cash_movement', '/fiscal-retail/pos/sessions/{id}/cash-movements', {
          fields: [req(rf.select('type', CASH_MOVEMENT_TYPES)), req(rf.decimal('amount', { positive: true })), rf.text('reason', { maxLength: 190, requiredIf: { field: 'type', value: 'pay_out' } })],
          visible: whenIn('status', 'open'),
          showResult: true,
        }),
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
          req(rf.text('terminal_code', { maxLength: 50 })),
          req(rf.text('name', { maxLength: 255 })),
          rf.text('hardware_serial', { maxLength: 100 }),
          rf.text('rt_serial_number', { maxLength: 50 }),
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
      id: 'tickets',
      titleKey: 'RES.P.pos_tickets',
      module: 'fiscal_retail',
      list: { path: '/retail/pos/sessions', columns: [...cols('terminal_id', 'opening_float'), tagCol('status'), col('opened_at', 'datetime')] },
      toolbar: [
        act('POST', 'RES.A.new_ticket', '/fiscal-retail/pos/tickets', {
          fields: [req(rf.uuid('pos_session_id')), rf.uuid('contact_id'), ticketItems('items'), ticketPayments('payments')],
          showResult: true,
        }),
        act('POST', 'RES.A.preview_promotions', '/fiscal-retail/pos/promotions/preview', { fields: [ticketItems('items')], showResult: true }),
        act('GET', 'RES.A.find_ticket', '/fiscal-retail/pos/tickets/{saleId}', { fields: [SALE_ID], showResult: true }),
      ],
    },
    {
      id: 'promotions',
      titleKey: 'RES.P.pos_promotions',
      module: 'fiscal_retail',
      list: {
        path: '/fiscal-retail/pos/promotions',
        filters: [rf.select('type', PROMOTION_TYPES), rf.bool('is_active')],
        columns: [...cols('code', 'name'), tagCol('type'), col('value', 'decimal'), ...cols('priority'), col('starts_at', 'datetime'), col('ends_at', 'datetime'), col('is_stackable', 'bool'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_promotion', '/fiscal-retail/pos/promotions', { fields: PROMOTION_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/fiscal-retail/pos/promotions/{id}', { prefill: true, fields: PROMOTION_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/fiscal-retail/pos/promotions/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'returns',
      titleKey: 'RES.P.pos_returns',
      module: 'fiscal_retail',
      list: { path: '/fiscal-retail/pos/returns', columns: [...cols('number', 'refund_method'), col('total_gross', 'decimal'), col('credit_applied', 'decimal'), col('cash_refunded', 'decimal'), col('created_at', 'datetime')] },
      detailPath: '/fiscal-retail/pos/returns/{id}',
      toolbar: [
        act('POST', 'RES.A.new_return', '/fiscal-retail/pos/sales/{saleId}/returns', {
          fields: [
            SALE_ID,
            req(rf.uuid('pos_session_id')),
            req(rf.lines('lines', [req(rf.uuid('pos_sale_item_id')), req(rf.decimal('quantity', { positive: true }))], { required: true })),
            req(rf.select('refund_method', REFUND_METHODS)),
            rf.text('reason', { maxLength: 190 }),
            rf.json('exchange'),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'z-reports',
      titleKey: 'RES.P.pos_z_reports',
      module: 'fiscal_retail',
      list: {
        path: '/fiscal-retail/pos/z-reports',
        filters: [rf.date('from'), rf.date('to', { notBefore: 'from' })],
        columns: [...cols('number', 'pos_session_id'), col('business_date', 'date'), col('created_at', 'datetime')],
      },
      rowActions: [act('GET', 'RES.A.z_report', '/fiscal-retail/pos/sessions/{pos_session_id}/z-report', { showResult: true })],
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
