import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

/** The portal as the supplier sees it: registration, documents, orders, quotations, invoices and bank changes. */
export const SUPPLIER_SELF_SERVICE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SUPPLIER_SELF_SERVICE',
  tabs: [
    {
      id: 'profile',
      titleKey: 'RES.P.supplier_profile',
      module: 'supplier_portal',
      list: { path: '/supplier-self-service/me', columns: [], report: true },
      toolbar: [
        act('POST', 'RES.A.supplier_register', '/supplier-self-service/registration', {
          fields: [
            req(rf.text('legal_name', { maxLength: 190 })),
            req(rf.select('country', ['IT', 'CH'])),
            req(rf.text('vat_number', { maxLength: 40 })),
            rf.text('tax_code', { maxLength: 40 }),
            req(rf.text('address_line', { maxLength: 190 })),
            req(rf.text('postal_code', { maxLength: 20 })),
            req(rf.text('city', { maxLength: 120 })),
            req(rf.text('contact_name', { maxLength: 190 })),
            req(rf.text('contact_email', { maxLength: 190 })),
            rf.text('contact_phone', { maxLength: 40 }),
          ],
        }),
        act('POST', 'RES.A.supplier_upload_document', '/supplier-self-service/documents', {
          fields: [
            req(rf.uuid('requirement_id')),
            rf.text('reference', { maxLength: 100 }),
            rf.date('issued_at'),
            rf.date('expires_at'),
            rf.textarea('notes', { maxLength: 2000 }),
            req(rf.file('file')),
          ],
        }),
        act('POST', 'RES.A.supplier_submit_for_review', '/supplier-self-service/submit-for-review', { confirm: true }),
      ],
    },
    {
      id: 'purchase-orders',
      titleKey: 'RES.P.supplier_purchase_orders',
      module: 'supplier_portal',
      list: {
        path: '/supplier-self-service/purchase-orders',
        columns: [...cols('order_number'), tagCol('status'), col('date', 'date'), col('expected_delivery_date', 'date'), col('total_gross', 'decimal'), ...cols('currency')],
      },
      detailPath: '/supplier-self-service/purchase-orders/{id}',
    },
    {
      id: 'rfqs',
      titleKey: 'RES.P.supplier_rfqs',
      module: 'supplier_portal',
      list: {
        path: '/supplier-self-service/rfqs',
        columns: [...cols('rfq_number', 'title'), tagCol('status'), tagCol('invitation_status'), col('response_deadline', 'datetime'), col('can_quote', 'bool')],
      },
      detailPath: '/supplier-self-service/rfqs/{id}',
      rowActions: [
        act('POST', 'RES.A.supplier_quote_rfq', '/supplier-self-service/rfqs/{id}/quote', {
          fields: [
            rf.text('quote_reference', { maxLength: 100 }),
            rf.date('valid_until'),
            rf.integer('lead_time_days', { min: 0 }),
            rf.textarea('notes', { maxLength: 2000 }),
            req(
              rf.lines('lines', [
                req(rf.uuid('rfq_line_id')),
                req(rf.decimal('unit_price', { min: 0 })),
                rf.decimal('quantity', { min: 0 }),
                rf.decimal('tax_rate', { min: 0, max: 100 }),
                rf.integer('lead_time_days', { min: 0 }),
              ]),
            ),
          ],
          visible: (row) => row['can_quote'] === true,
        }),
        act('POST', 'RES.A.supplier_decline_rfq', '/supplier-self-service/rfqs/{id}/decline', {
          confirm: true,
          danger: true,
          visible: (row) => row['can_quote'] === true,
        }),
      ],
    },
    {
      id: 'invoices',
      titleKey: 'RES.P.supplier_invoices',
      module: 'supplier_portal',
      list: {
        path: '/supplier-self-service/invoices',
        columns: [
          ...cols('invoice_number'),
          tagCol('document_type'),
          col('date', 'date'),
          col('due_date', 'date'),
          col('total_amount', 'decimal'),
          col('total_paid', 'decimal'),
          tagCol('processing_status'),
          tagCol('payment_status'),
        ],
      },
    },
    {
      id: 'bank-changes',
      titleKey: 'RES.P.supplier_bank_changes',
      module: 'supplier_portal',
      list: {
        path: '/supplier-self-service/bank-changes',
        columns: [...cols('account_holder', 'iban_masked'), tagCol('status'), col('created_at', 'datetime'), ...cols('rejection_reason')],
      },
      create: act('POST', 'RES.A.supplier_request_bank_change', '/supplier-self-service/bank-changes', {
        fields: [
          req(rf.uuid('supplier_id')),
          req(rf.text('account_holder', { maxLength: 190 })),
          req(rf.text('iban', { maxLength: 40 })),
          rf.text('bic', { maxLength: 20 }),
          rf.text('bank_name', { maxLength: 190 }),
          rf.textarea('reason', { maxLength: 2000 }),
        ],
      }),
    },
  ],
};
