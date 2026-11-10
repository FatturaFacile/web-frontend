/** Field service work orders (`/field-service/work-orders`) and service reports (`/service-reports`). */

export type FieldWorkOrderLineType = 'labor' | 'material' | 'travel';

export interface FieldWorkOrder {
  id: string;
  tenant_id: string | null;
  ticket_id: string | null;
  client_id: string;
  technician_user_id: string | null;
  work_order_number: string;
  date: string;
  labor_hours: string;
  hourly_rate: string;
  parts_total: string;
  total_amount: string;
  client_signature_path: string | null;
  client_signed_by: string | null;
  signed_at: string | null;
  status: string;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  intervention_address: string | null;
  invoice_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FieldWorkOrderLinePayload {
  type?: FieldWorkOrderLineType | null;
  product_id?: string | null;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  tax_rate: number | string;
}

export interface FieldWorkOrderPayload {
  client_id: string;
  ticket_id?: string | null;
  technician_user_id?: string | null;
  date: string;
  started_at?: string | null;
  ended_at?: string | null;
  intervention_address?: string | null;
  notes?: string | null;
  lines: FieldWorkOrderLinePayload[];
}

export interface FieldWorkOrderListParams {
  page?: number;
  per_page?: number;
}

/** Laravel paginator nested in the standard envelope, as returned by the work order list. */
export interface FieldWorkOrderPage {
  current_page: number;
  data: FieldWorkOrder[];
  last_page: number;
  per_page: number;
  total: number;
}

export interface WorkOrderSignaturePayload {
  signed_by: string;
  signature_base64: string;
}

export type ServiceReportPhotoStage = 'before' | 'after' | 'general' | 'receipt';

export interface ServiceReportSummary {
  id: string;
  report_number: string;
  report_date: string;
  status?: { id: string; code: string; label: string };
  contact_id: string;
  contact?: { id: string; name: string | null; email: string | null; phone: string | null };
  technician?: { id: string; name: string; email: string };
  total_hours: number | string;
  total_net: number | string;
  total_tax: number | string;
  total_gross: number | string;
  signed_at: string | null;
  invoiced_at: string | null;
  is_signed: boolean;
  is_invoiced: boolean;
  invoice_id: string | null;
}

export interface ServiceReportListParams {
  status?: string;
  contact_id?: string;
  technician_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}

export interface ServiceReportSignPayload {
  signature_base64: string;
  signer_name: string;
  signer_role?: string | null;
  signer_email?: string | null;
}

export interface ServiceReportPhoto {
  id: string;
  original_name: string;
  stage: ServiceReportPhotoStage | null;
  size: number;
  created_at: string | null;
}

/** Invoice drafted from reports or work orders: only the fields the screens show. */
export interface GeneratedInvoice {
  id: string;
  invoice_number: string;
  total_gross: number | string;
  status: string;
}
