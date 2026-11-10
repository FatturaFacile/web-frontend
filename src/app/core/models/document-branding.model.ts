export const DOCUMENT_TEMPLATE_TYPES = [
  'default',
  'invoice',
  'credit_note',
  'proforma',
  'quote',
  'order',
  'delivery_note',
  'work_order',
  'service_report',
] as const;

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number];

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  document_type: DocumentTemplateType | string;
  logo_data_uri: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  footer_text: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SaveDocumentTemplatePayload {
  logo_base64?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  footer_text?: string | null;
}

export interface DocumentQuota {
  enabled: boolean;
  limit: string | null;
  used: string;
  remaining: string | null;
  year: number | null;
}
