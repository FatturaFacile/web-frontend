export interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  vat_number?: string;
  tax_code?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface PortalSummary {
  pending_quotes: number;
  unpaid_invoices: number;
  open_tickets: number;
  upcoming_appointments: number;
}

export interface PortalAccessData {
  customer: PortalCustomer;
  token_type?: string;
  scope_type?: string;
  scope_id?: string;
  expires_at?: string;
  summary: PortalSummary;
}

export interface PortalQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number;
  line_total: number;
}

export interface PortalQuote {
  id: string;
  quote_number: string;
  date: string;
  valid_until?: string;
  currency: string;
  total_net: number;
  total_tax: number;
  total_gross: number;
  status: string;
  is_accepted: boolean;
  is_rejected: boolean;
  signed_by?: string;
  signed_at?: string;
  notes?: string;
  custom_text?: string;
  items: PortalQuoteItem[];
}

export interface ApprovePortalQuoteRequest {
  signer_name: string;
  signature_data?: string | null;
  notes?: string | null;
}

export interface RejectPortalQuoteRequest {
  reason?: string | null;
}

export interface PortalInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  date: string;
  due_date?: string;
  currency: string;
  total_net: number;
  total_tax: number;
  total_gross: number;
  total_paid: number;
  payment_status: 'paid' | 'partial' | 'unpaid' | 'overdue' | string;
  is_paid: boolean;
  notes?: string;
  items?: PortalInvoiceItem[];
}

export interface PortalAttachment {
  id: string;
  original_name?: string;
  mime_type?: string;
  size?: number;
}

export interface PortalServiceReportLine {
  id: string;
  description: string;
  quantity: number;
  unit_of_measure?: string;
  unit_price?: number;
  line_total?: number;
}

export interface PortalServiceReport {
  id: string;
  report_number: string;
  report_date: string;
  site_address?: string;
  customer_notes?: string;
  total_hours: number;
  is_signed: boolean;
  signed_at?: string;
  lines: PortalServiceReportLine[];
  attachments?: PortalAttachment[];
}

export interface PortalAppointment {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | string;
  location?: string;
  technician_name?: string;
  notes?: string;
}

export interface PortalHelpdeskTicket {
  id: string;
  ticket_number: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed' | string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | string;
  created_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
}

export interface PortalHelpdeskMessage {
  id: string;
  author_name?: string;
  author_type?: 'customer' | 'agent' | 'system';
  message: string;
  created_at: string;
  attachments?: PortalAttachment[];
}

export interface CreatePortalTicketRequest {
  subject: string;
  description: string;
}

export interface ReplyPortalTicketRequest {
  message: string;
  author_name?: string | null;
}

export interface PortalCsatSurvey {
  ticket_id: string;
  ticket_number: string;
  can_answer: boolean;
  score?: number;
  feedback?: string;
  submitted_at?: string;
}

export interface AnswerPortalCsatRequest {
  score: number;
  feedback?: string | null;
}

export interface PortalKnowledgeCategory {
  id: string;
  name: string;
  description?: string;
  articles_count?: number;
}

export interface PortalKnowledgeArticle {
  id: string;
  article_number?: string;
  title: string;
  summary?: string;
  content: string;
  knowledge_category_id?: string;
  views_count?: number;
  helpful_count?: number;
  updated_at?: string;
}

export interface PortalSubscription {
  id: string;
  subscription_number: string;
  name: string;
  plan: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired' | string;
  currency: string;
  next_billing_date?: string | null;
  term_end_date?: string | null;
  auto_renew: boolean;
  invoices?: {
    invoice_number: string;
    date: string;
    total_gross: string;
    payment_status: string;
  }[];
}

/** A stock line of `GET /portal/stock/{token}`, grouped by warehouse, item and lot. */
export interface PortalStockLine {
  warehouse_id: string | null;
  stock_item_id: string;
  sku: string | null;
  name: string | null;
  lot_number: string | null;
  expiration_date: string | null;
  quantity_on_hand: string;
  quantity_reserved: string;
  quantity_available: string;
}

export interface PortalMovementRequest {
  id: string;
  request_type: 'withdrawal' | 'return' | 'transfer';
  quantity: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_date?: string | null;
  notes?: string | null;
  decision_note?: string | null;
}

export interface CreatePortalMovementRequest {
  warehouse_id: string;
  stock_item_id: string;
  request_type: 'withdrawal' | 'return' | 'transfer';
  quantity: number | string;
  requested_date?: string | null;
  notes?: string | null;
}

export interface CustomsPortalDossier {
  id: string;
  dossier_number: string;
  direction: 'import' | 'export' | 'transit';
  status: string;
  origin_country: string;
  destination_country: string;
  packages: number;
  gross_weight_kg: number;
  created_at: string;
}

export interface CustomsPortalShipmentRequest {
  service_type: string;
  direction: 'import' | 'export' | 'transit';
  origin_country: string;
  destination_country: string;
  gross_weight_kg: number;
  volume_m3?: number;
  packages: number;
  pickup_on?: string | null;
  notes?: string | null;
}

export type PortalStockMovementDirection = 'internal' | 'in' | 'out';

/** One stock movement of the customer's consigned goods (`GET /portal/stock-movements/{token}`). */
export interface PortalStockMovement {
  id: string;
  executed_at: string | null;
  direction: PortalStockMovementDirection;
  sku: string | null;
  name: string | null;
  lot_number: string | null;
  /** Decimal string. */
  quantity: string;
}

export interface PortalStockMovementPage {
  data: PortalStockMovement[];
  meta: { current_page: number; last_page: number; total: number };
}

/** A ticket as listed by `GET /portal/tickets/{token}`: helpdesk tickets and tickets of the former table. */
export type PortalTicketListItem = PortalHelpdeskTicket & { messages?: PortalHelpdeskMessage[] };

export interface PortalTicketReplyRequest {
  message: string;
  author_name?: string | null;
  attachments?: File[];
}

export interface PayslipLinkRequest {
  /** `YYYY-MM-DD`. */
  birth_date: string;
}
