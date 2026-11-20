import {
  BoundingBoxMap,
  ExtractedPayload,
  InboxItem,
  InboxPage,
  PurchaseOrderView,
  Workbench,
} from './ocr-inbox.models';

/** A Swiss invoice read from a QR-bill: exact payment fields, OCR lines, two lines of different confidence. */
export function payloadFixture(overrides: Partial<ExtractedPayload> = {}): ExtractedPayload {
  return {
    vendor: {
      name: 'Muster AG',
      uid: 'CHE-123.456.789',
      vat_number: null,
      fiscal_code: null,
      iban: null,
      qr_iban: 'CH4431999123000889012',
    },
    document: {
      number: 'R-2026-17',
      issue_date: '2026-03-05',
      due_date: '2026-04-04',
      currency: 'CHF',
      qr_reference: '210000000003139471430009017',
      qr_reference_type: 'QRR',
    },
    order_references: ['PO-2026-77'],
    totals: { net: 1250, vat: 106.1, gross: 1356.1 },
    vat_breakdown: [
      { rate: 8.1, net: 1200, vat: 97.2 },
      { rate: 2.6, net: 50, vat: 1.3 },
    ],
    lines: [
      {
        description: 'Montage Heizung',
        quantity: 10,
        unit_price: 120,
        net_amount: 1200,
        vat_rate: 8.1,
        suggested_gl_account_id: 'gl-1',
        suggested_vat_code_id: 'vat-std',
        suggested_cost_center_id: null,
        coding_confidence: 100,
        coding_source: 'exact',
        prediction_model_id: 'm-1',
      },
      {
        description: 'Verpflegung',
        quantity: 1,
        unit_price: 50,
        net_amount: 50,
        vat_rate: 2.6,
        coding_confidence: 0,
        coding_source: 'none',
      },
    ],
    field_confidence: {
      'vendor.name': 100,
      'vendor.qr_iban': 100,
      'header.document_number': 100,
      'header.issue_date': 95,
      'totals.gross': 100,
      'lines[0].unit_price': 82,
      'lines[1].unit_price': 55,
    },
    meta: { source_format: 'swiss_qr_bill', warnings: [] },
    three_way_match: [],
    ...overrides,
  };
}

export const boxesFixture: BoundingBoxMap = {
  'header.document_number': { page: 1, x: 0.1, y: 0.2, width: 0.2, height: 0.03 },
  'header.issue_date': { page: 1, x: 0.4, y: 0.2, width: 0.2, height: 0.03 },
  'lines[0].unit_price': { page: 1, x: 0.7, y: 0.45, width: 0.1, height: 0.02 },
  'lines[1].unit_price': { page: 2, x: 0.7, y: 0.1, width: 0.1, height: 0.02 },
};

export function purchaseOrderFixture(
  overrides: Partial<PurchaseOrderView> = {},
): PurchaseOrderView {
  return {
    id: 'po-1',
    number: 'PO-2026-77',
    status: 'sent',
    currency: 'CHF',
    total: 1300,
    lines: [
      {
        id: 'pol-1',
        description: 'Montage Heizung',
        quantity_ordered: 10,
        quantity_received: 10,
        unit_price: 110,
      },
    ],
    goods_receipts: [{ id: 'gr-1', receipt_number: 'GR-1', received_date: '2026-03-01' }],
    evaluation: {
      purchase_order_id: 'po-1',
      purchase_order_number: 'PO-2026-77',
      matched_by: 'reference',
      status: 'variance',
      unmatched_invoice_lines: [1],
      lines: [
        {
          invoice_line_index: 0,
          purchase_order_line_id: 'pol-1',
          price_variance: 10,
          price_variance_percent: 9.09,
          quantity_variance: 0,
          received_variance: 0,
          within_tolerance: false,
        },
      ],
    },
    ...overrides,
  };
}

export function workbenchFixture(overrides: Partial<Workbench> = {}): Workbench {
  return {
    id: 'job-1',
    status: 'ready_for_review',
    document_category: 'vendor_invoice',
    source_channel: 'dms_upload',
    extraction_method: 'hybrid_qr_plus_ocr',
    ocr_provider_used: 'ollama_local',
    overall_confidence_score: 91.4,
    llm_tokens_used: 1200,
    failure_reason: null,
    source: {
      url: 'https://api.test/api/v1/ocr-inbox/job-1/source?signature=x',
      mime_type: 'application/pdf',
      file_name: 'r.pdf',
    },
    payload: payloadFixture(),
    bounding_boxes: boxesFixture,
    review_draft: null,
    vendor: {
      id: 'v-1',
      company_name: 'Muster AG',
      vat_number: null,
      uid_number: 'CHE-123.456.789',
      iban: null,
      qr_iban: null,
      country: 'CH',
    },
    lookups: {
      gl_accounts: [
        { id: 'gl-1', code: '4000', name: 'Materialaufwand' },
        { id: 'gl-2', code: '4100', name: 'Fremdleistungen' },
      ],
      vat_codes: [
        {
          id: 'vat-std',
          code: 'CH-STD',
          description: 'Normalsatz',
          rate: 8.1,
          tax_rate_percent: 8.1,
          country_iso: 'CH',
        },
        {
          id: 'vat-red',
          code: 'CH-RED',
          description: 'Reduziert',
          rate: 2.6,
          tax_rate_percent: 2.6,
          country_iso: 'CH',
        },
      ],
      cost_centers: [{ id: 'cc-1', code: 'CC1', name: 'Werkstatt' }],
    },
    three_way_match: { purchase_orders: [purchaseOrderFixture()] },
    resulting_entity: null,
    ...overrides,
  };
}

export function itemFixture(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'job-1',
    status: 'ready_for_review',
    document_category: 'vendor_invoice',
    source_channel: 'mobile_camera',
    extraction_method: 'hybrid_qr_plus_ocr',
    ocr_provider_used: 'ollama_local',
    overall_confidence_score: 91.4,
    dms_document_id: 'doc-1',
    document_title: 'r.pdf',
    vendor_id: 'v-1',
    vendor_name: 'Muster AG',
    failure_reason: null,
    created_at: '2026-03-05T10:00:00Z',
    ...overrides,
  };
}

export function pageFixture(overrides: Partial<InboxPage> = {}): InboxPage {
  return {
    counters: { queued: 1, processing: 0, ready_for_review: 2, failed: 1 },
    queue: [
      itemFixture(),
      itemFixture({
        id: 'job-2',
        status: 'failed',
        document_title: 'x.png',
        failure_reason: 'ollama_local: unreachable',
        vendor_id: null,
        vendor_name: null,
      }),
    ],
    meta: { current_page: 1, last_page: 1, per_page: 25, total: 2 },
    selected: null,
    ...overrides,
  };
}
