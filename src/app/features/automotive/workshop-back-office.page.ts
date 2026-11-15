import { act, col, cols, ResourceField, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const LINE_TYPES = ['labour', 'part', 'paint', 'sublet', 'other'] as const;

/** Lines of an estimate: the same payload as a folder line (`WorkshopFolderLineRequest`). */
const estimateLine = (): ResourceField[] => [
  req(rf.select('line_type', LINE_TYPES, { defaultValue: 'labour' })),
  rf.uuid('product_id'),
  req(rf.text('description', { maxLength: 500 })),
  req(rf.decimal('quantity', { positive: true })),
  req(rf.decimal('unit_price', { min: 0 })),
  rf.decimal('discount_percentage', { min: 0, max: 100 }),
  req(rf.decimal('tax_rate', { min: 0, max: 100 })),
];

/** Estimates: labour and part lines offered to the customer, sent, approved or rejected, then converted into a work folder. */
export const AUTOMOTIVE_ESTIMATES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.AUTOMOTIVE_ESTIMATES',
  tabs: [
    {
      id: 'estimates',
      titleKey: 'RES.P.workshop_estimates',
      module: 'workshop',
      list: {
        path: '/workshop/estimates',
        filters: [rf.select('status', ['draft', 'sent', 'approved', 'rejected', 'converted'])],
        columns: [
          ...cols('estimate_number', 'vehicle.license_plate'),
          tagCol('kind'),
          tagCol('status'),
          col('total', 'decimal'),
          ...cols('currency'),
          col('valid_until', 'date'),
        ],
      },
      detailPath: '/workshop/estimates/{id}',
      create: act('POST', 'RES.A.new_estimate', '/workshop/estimates', {
        fields: [
          req(rf.uuid('vehicle_id')),
          rf.lookup('contact_id', 'contacts'),
          req(rf.select('kind', ['mechanics', 'bodywork', 'tyres', 'inspection', 'other'], { defaultValue: 'mechanics' })),
          req(rf.text('currency', { maxLength: 3, defaultValue: 'CHF' })),
          rf.date('valid_until'),
          rf.integer('mileage_in', { min: 0 }),
          rf.textarea('complaint', { maxLength: 5000 }),
          rf.textarea('diagnosis', { maxLength: 5000 }),
          rf.textarea('notes', { maxLength: 5000 }),
          rf.lines('lines', estimateLine()),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.add_estimate_line', '/workshop/estimates/{id}/lines', {
          fields: estimateLine(),
          visible: whenIn('status', 'draft'),
        }),
        act('POST', 'RES.A.send_estimate', '/workshop/estimates/{id}/send', { visible: whenIn('status', 'draft') }),
        act('POST', 'RES.A.approve_estimate', '/workshop/estimates/{id}/approve', {
          fields: [rf.text('note', { maxLength: 500 })],
          visible: whenIn('status', 'sent'),
        }),
        act('POST', 'RES.A.reject_estimate', '/workshop/estimates/{id}/reject', {
          fields: [rf.text('note', { maxLength: 500 })],
          visible: whenIn('status', 'sent'),
        }),
        act('POST', 'RES.A.convert_estimate', '/workshop/estimates/{id}/convert', { confirm: true, visible: whenIn('status', 'approved') }),
        act('DELETE', 'RES.A.delete_estimate', '/workshop/estimates/{id}', { confirm: true, danger: true, visible: whenIn('status', 'draft') }),
      ],
    },
  ],
};

/** Warranty claims against the supplier of a part or service used on a work folder, with the amount reimbursed. */
export const AUTOMOTIVE_WARRANTY_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.AUTOMOTIVE_WARRANTY',
  tabs: [
    {
      id: 'claims',
      titleKey: 'RES.P.workshop_warranty_claims',
      module: 'workshop',
      list: {
        path: '/workshop/warranty-claims',
        filters: [rf.select('status', ['draft', 'submitted', 'accepted', 'rejected', 'reimbursed']), rf.uuid('folder_id')],
        columns: [
          ...cols('claim_number', 'folder.folder_number'),
          tagCol('status'),
          col('claimed_amount', 'decimal'),
          col('reimbursed_amount', 'decimal'),
          ...cols('currency', 'supplier_reference'),
        ],
      },
      detailPath: '/workshop/warranty-claims/{id}',
      create: act('POST', 'RES.A.new_warranty_claim', '/workshop/warranty-claims', {
        fields: [
          req(rf.uuid('folder_id')),
          rf.uuid('folder_line_id'),
          rf.uuid('product_id'),
          rf.lookup('supplier_contact_id', 'suppliers'),
          req(rf.textarea('description', { maxLength: 5000 })),
          rf.decimal('claimed_amount', { min: 0 }),
          rf.text('supplier_reference', { maxLength: 100 }),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_warranty_claim', '/workshop/warranty-claims/{id}', {
          fields: [
            rf.uuid('product_id'),
            rf.lookup('supplier_contact_id', 'suppliers'),
            rf.textarea('description', { maxLength: 5000 }),
            rf.decimal('claimed_amount', { min: 0 }),
            rf.text('supplier_reference', { maxLength: 100 }),
          ],
          prefill: true,
          visible: whenIn('status', 'draft'),
        }),
        act('POST', 'RES.A.submit_warranty_claim', '/workshop/warranty-claims/{id}/submit', {
          fields: [rf.text('supplier_reference', { maxLength: 100 })],
          visible: whenIn('status', 'draft'),
        }),
        act('POST', 'RES.A.accept_warranty_claim', '/workshop/warranty-claims/{id}/accept', {
          fields: [rf.text('note', { maxLength: 500 })],
          visible: whenIn('status', 'submitted'),
        }),
        act('POST', 'RES.A.reject_warranty_claim', '/workshop/warranty-claims/{id}/reject', {
          fields: [rf.text('note', { maxLength: 500 })],
          visible: whenIn('status', 'submitted'),
        }),
        act('POST', 'RES.A.reimburse_warranty_claim', '/workshop/warranty-claims/{id}/reimburse', {
          fields: [req(rf.decimal('reimbursed_amount', { min: 0 })), req(rf.date('reimbursed_on'))],
          visible: whenIn('status', 'accepted'),
        }),
      ],
    },
  ],
};

/** Parts a work folder takes from stock: reserved, issued when fitted, released when unused. */
export const AUTOMOTIVE_PARTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.AUTOMOTIVE_PARTS',
  tabs: [
    {
      id: 'folder-parts',
      titleKey: 'RES.P.workshop_parts',
      module: 'workshop',
      list: {
        path: '/workshop/folders/{folder_id}/parts',
        scope: rf.uuid('folder_id'),
        columns: [...cols('product_id'), col('quantity', 'decimal'), tagCol('status'), col('issued_at', 'datetime'), col('released_at', 'datetime')],
      },
      create: act('POST', 'RES.A.reserve_part', '/workshop/folders/{folder_id}/parts', {
        fields: [req(rf.uuid('product_id')), req(rf.decimal('quantity', { positive: true })), rf.uuid('folder_line_id')],
      }),
      rowActions: [
        act('POST', 'RES.A.issue_part', '/workshop/part-consumptions/{id}/issue', { confirm: true, visible: whenIn('status', 'reserved') }),
        act('POST', 'RES.A.release_part', '/workshop/part-consumptions/{id}/release', { confirm: true, visible: whenIn('status', 'reserved') }),
      ],
    },
  ],
};
