/** Field service service reports (`/service-reports`); work orders live in fsm.model.ts. */

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
