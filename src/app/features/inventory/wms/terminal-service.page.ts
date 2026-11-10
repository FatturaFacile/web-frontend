import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const TERMINAL_FIELDS = [
  req(rf.text('device_id')),
  req(rf.text('client_scan_id')),
  req(rf.text('item_code')),
  req(rf.text('bin_code')),
  rf.text('from_bin_code'),
  rf.text('to_bin_code'),
  rf.text('destination_bin_code'),
  req(rf.decimal('quantity')),
  rf.text('lot_number'),
  rf.datetime('expiration_date'),
  rf.text('serial_number'),
  rf.uuid('pick_line_id'),
  rf.uuid('session_id'),
  rf.uuid('purchase_receipt_id'),
];

const terminal = (labelKey: string, path: string) => act('POST', labelKey, path, { fields: TERMINAL_FIELDS, showResult: true });

/** Handheld support: barcode lookup/scan (GS1-128, GTIN, SKU, bin, lot, serial) and terminal operations. */
export const TERMINAL_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.TERMINAL',
  tabs: [
    {
      id: 'barcode',
      titleKey: 'RES.P.barcode',
      module: 'inventory',
      list: {
        path: '/inventory/barcode/lookup',
        report: true,
        manual: true,
        filters: [req(rf.text('code')), rf.lookup('warehouse_id', 'warehouses')],
        columns: [],
      },
      toolbar: [
        terminal('RES.A.terminal_receipt', '/inventory/terminal/receipt'),
        terminal('RES.A.terminal_pick', '/inventory/terminal/pick'),
        terminal('RES.A.terminal_transfer', '/inventory/terminal/transfer'),
        terminal('RES.A.terminal_count', '/inventory/terminal/count'),
        act('POST', 'RES.A.scan', '/inventory/barcode/scan', {
          fields: [
            req(rf.text('raw_payload')),
            req(rf.select('symbology', ['auto', 'GS1-128', 'EAN-13', 'CODE-128', 'QR', 'DataMatrix'], { defaultValue: 'auto' })),
            rf.lookup('warehouse_id', 'warehouses'),
          ],
          showResult: true,
        }),
        act('POST', 'RES.A.barcode_label', '/inventory/labels/barcode', {
          fields: [
            req(rf.select('target', ['item', 'lot', 'serial', 'bin', 'package'])),
            req(rf.uuid('id')),
            req(rf.select('symbology', ['ean13', 'code39'])),
            rf.select('format', ['svg', 'png']),
          ],
          download: true,
        }),
      ],
    },
    {
      id: 'portal-requests',
      titleKey: 'RES.P.portal_requests',
      module: 'inventory',
      list: { path: '/inventory/portal-requests', filters: [rf.text('status')], columns: [...cols('id'), tagCol('status'), col('created_at', 'datetime')] },
      rowActions: [
        act('POST', 'RES.A.approve', '/inventory/portal-requests/{id}/approve', {
          fields: [rf.textarea('decision_note')],
          visible: whenIn('status', 'pending'),
        }),
        act('POST', 'RES.A.reject', '/inventory/portal-requests/{id}/reject', {
          fields: [rf.textarea('decision_note')],
          danger: true,
          visible: whenIn('status', 'pending'),
        }),
      ],
    },
  ],
};
