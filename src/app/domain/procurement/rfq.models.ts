export type RfqStatus =
  | 'draft'
  | 'published'
  | 'bidding_open'
  | 'issued'
  | 'under_evaluation'
  | 'awarded'
  | 'cancelled'
  | 'expired';

export type InvitationStatus =
  | 'pending'
  | 'sent'
  | 'invited'
  | 'viewed'
  | 'declined'
  | 'bid_submitted'
  | 'responded'
  | 'awarded_full'
  | 'awarded_partial'
  | 'not_awarded';

export type BidStatus = 'draft' | 'submitted' | 'revised' | 'withdrawn' | 'received' | 'awarded' | 'rejected';

export type AwardMode = 'full' | 'split';

export interface EvaluationWeights {
  price_weight: number;
  lead_time_weight: number;
  supplier_rating_weight: number;
}

export interface RfqLine {
  id: string;
  rfq_id: string;
  line_number: number;
  source_requisition_line_id: string | null;
  item_id: string | null;
  custom_item_code: string | null;
  internal_sku: string | null;
  description: string;
  technical_specifications: string | null;
  quantity: string;
  uom: string;
  unit_of_measure: string;
  target_unit_price: string | null;
  requested_delivery_date: string | null;
  awarded_supplier_id: string | null;
  awarded_supplier_name?: string | null;
  awarded_bid_line_id: string | null;
  generated_purchase_order_id: string | null;
  generated_purchase_order_number?: string | null;
}

export interface RfqAttachment {
  id: string;
  rfq_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  sha256_hash: string;
  is_visible_to_suppliers: boolean;
  created_at: string | null;
}

export interface RfqInvitation {
  id: string;
  rfq_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_code?: string | null;
  supplier_rating?: string | null;
  status: InvitationStatus;
  token_expires_at: string | null;
  invited_at: string | null;
  first_viewed_at: string | null;
  submitted_at: string | null;
  responded_at: string | null;
  declined_reason: string | null;
  notified_outcome_at: string | null;
}

export interface SupplierBidLine {
  id: string;
  supplier_bid_id: string;
  rfq_line_id: string;
  is_no_bid: boolean;
  quoted_quantity: string;
  unit_price: string;
  discount_percent: string;
  net_unit_price: string;
  tax_rate: string;
  line_total: string;
  line_total_net: string;
  lead_time_days: number | null;
  promised_delivery_date: string | null;
  supplier_notes: string | null;
  line_weighted_score: string | null;
  is_awarded: boolean;
}

export interface SupplierBid {
  id: string;
  rfq_id: string;
  invitation_id: string | null;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_quote_reference?: string | null;
  quote_date?: string | null;
  valid_until?: string | null;
  currency_code?: string;
  exchange_rate_to_rfq?: string;
  payment_terms_days?: number;
  incoterms?: string | null;
  shipping_cost?: string;
  lead_time_days?: number | null;
  status: BidStatus;
  total_amount?: string;
  total_net_amount?: string;
  total_landed_cost?: string;
  weighted_overall_score?: string | null;
  general_notes?: string | null;
  quote_attachment_file_name?: string | null;
  submitted_at: string | null;
  is_redacted: boolean;
  lines?: SupplierBidLine[];
}

export interface RfqSummary {
  id: string;
  rfq_number: string;
  title: string;
  description: string | null;
  status: RfqStatus;
  purchase_requisition_id: string | null;
  issue_date: string | null;
  response_deadline: string | null;
  submission_deadline: string;
  expected_delivery_date: string | null;
  currency: string;
  currency_code: string;
  incoterms: string | null;
  evaluation_weights: EvaluationWeights;
  sealed_bidding: boolean;
  is_sealed: boolean;
  buyer_user_id: string | null;
  buyer_name?: string | null;
  award_mode: AwardMode | null;
  awarded_supplier_id: string | null;
  awarded_quote_id: string | null;
  purchase_order_id: string | null;
  awarded_at: string | null;
  notes: string | null;
  lines_count?: number;
  invited_count?: number;
  bids_received_count: number;
  lines?: RfqLine[];
  attachments?: RfqAttachment[];
  invitations?: RfqInvitation[];
  bids?: SupplierBid[];
  created_at: string | null;
}

export interface MatrixColumn {
  bid_id: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  supplier_rating_grade: string | null;
  supplier_rating_score: number;
  quote_reference: string | null;
  currency_code: string | null;
  exchange_rate_to_rfq: string | null;
  payment_terms_days: number | null;
  incoterms: string | null;
  shipping_cost: string | null;
  valid_until: string | null;
  general_notes: string | null;
  total_net_amount: string | null;
  total_landed_cost: string | null;
  normalized_landed_cost: string | null;
  weighted_overall_score: string | null;
  quoted_line_count: number;
  covers_all_lines: boolean;
  is_lowest_total_cost: boolean;
  is_highest_score: boolean;
  status: string;
  submitted_at: string | null;
  is_redacted?: boolean;
}

export interface MatrixCell {
  bid_id: string;
  supplier_id: string;
  supplier_bid_line_id: string | null;
  is_no_bid: boolean;
  quoted_quantity: string | null;
  unit_price: string | null;
  discount_percent: string | null;
  net_unit_price: string | null;
  line_total_net: string | null;
  normalized_net_unit_price: string | null;
  normalized_line_total_net: string | null;
  lead_time_days: number | null;
  promised_delivery_date: string | null;
  supplier_notes: string | null;
  price_score: string | null;
  lead_time_score: string | null;
  supplier_rating_score: string | null;
  line_weighted_score: string | null;
  is_lowest_price: boolean;
  is_fastest_delivery: boolean;
  is_highest_score: boolean;
  is_awarded: boolean;
}

export interface MatrixRow {
  rfq_line_id: string;
  line_number: number;
  item_id: string | null;
  custom_item_code: string | null;
  description: string;
  technical_specifications: string | null;
  quantity: string;
  unit_of_measure: string;
  target_unit_price: string | null;
  requested_delivery_date: string | null;
  awarded_supplier_id: string | null;
  awarded_bid_line_id: string | null;
  generated_purchase_order_id: string | null;
  best_unit_price: string | null;
  recommended_bid_line_id: string | null;
  cells: MatrixCell[];
}

export interface SplitLineAwardAllocation {
  rfq_line_id: string;
  supplier_bid_line_id: string;
  supplier_id?: string;
  bid_id?: string;
}

export interface BidComparisonMatrix {
  rfq_id: string;
  rfq_number: string;
  title: string;
  status: RfqStatus;
  currency_code: string;
  submission_deadline: string;
  sealed_bidding: boolean;
  is_sealed: boolean;
  can_award: boolean;
  evaluation_weights: EvaluationWeights;
  invitations: {
    id: string;
    supplier_id: string;
    supplier_name: string;
    supplier_rating_score: number;
    status: InvitationStatus;
    invited_at: string | null;
    first_viewed_at: string | null;
    submitted_at: string | null;
    declined_reason: string | null;
    notified_outcome_at: string | null;
  }[];
  columns: MatrixColumn[];
  rows: MatrixRow[];
  recommendations: {
    lowest_total_cost_bid_id: string | null;
    highest_score_bid_id: string | null;
    optimal_split_line_awards: SplitLineAwardAllocation[];
    lowest_price_split_line_awards: SplitLineAwardAllocation[];
  };
}

export interface ExternalRfqPortalLine {
  id: string;
  line_number: number;
  item_code: string | null;
  description: string;
  technical_specifications: string | null;
  quantity: string;
  unit_of_measure: string;
  requested_delivery_date: string | null;
}

export interface ExternalRfqPortalAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
}

export interface ExternalRfqPortalView {
  rfq: {
    id: string;
    rfq_number: string;
    title: string;
    description: string | null;
    status: RfqStatus;
    currency_code: string;
    incoterms: string | null;
    submission_deadline: string;
    expected_delivery_date: string | null;
    sealed_bidding: boolean;
    lines: ExternalRfqPortalLine[];
    attachments: ExternalRfqPortalAttachment[];
  };
  buyer_company: {
    name: string;
    country: string;
    vat_number: string | null;
  };
  invitation: {
    id: string;
    supplier_id: string;
    supplier_name: string | null;
    status: InvitationStatus;
    token_expires_at: string | null;
    first_viewed_at: string | null;
    submitted_at: string | null;
    declined_reason: string | null;
  };
  bid: SupplierBid | null;
  preferred_locale: 'it' | 'en' | 'de' | 'fr';
  is_open: boolean;
  can_submit: boolean;
}

export interface CreateRfqLinePayload {
  source_requisition_line_id?: string | null;
  item_id?: string | null;
  custom_item_code?: string | null;
  description: string;
  technical_specifications?: string | null;
  quantity: number | string;
  unit_of_measure: string;
  target_unit_price?: number | string | null;
  requested_delivery_date?: string | null;
}

export interface CreateRfqPayload {
  title: string;
  description?: string | null;
  currency_code: string;
  incoterms?: string | null;
  submission_deadline: string;
  expected_delivery_date?: string | null;
  sealed_bidding: boolean;
  evaluation_weights: EvaluationWeights;
  supplier_ids: string[];
  lines: CreateRfqLinePayload[];
  notes?: string | null;
}

export interface CreateRfqFromRequisitionsPayload {
  purchase_requisition_ids: string[];
  line_ids?: string[];
  title: string;
  description?: string | null;
  currency_code?: string | null;
  incoterms?: string | null;
  submission_deadline: string;
  expected_delivery_date?: string | null;
  sealed_bidding: boolean;
  consolidate_matching_items: boolean;
  evaluation_weights: EvaluationWeights;
  supplier_ids: string[];
  notes?: string | null;
}

export interface AwardRfqPayload {
  award_mode: AwardMode;
  supplier_id?: string;
  bid_id?: string;
  line_awards?: { rfq_line_id: string; supplier_bid_line_id: string }[];
  expected_delivery_date?: string | null;
  notes?: string | null;
}

export interface ExternalBidLinePayload {
  rfq_line_id: string;
  is_no_bid: boolean;
  quoted_quantity?: number | string;
  unit_price?: number | string | null;
  discount_percent?: number | string;
  lead_time_days?: number;
  promised_delivery_date?: string | null;
  supplier_notes?: string | null;
}

export interface ExternalBidSubmissionPayload {
  action: 'draft' | 'submit';
  supplier_quote_reference?: string | null;
  currency_code: string;
  payment_terms_days: number;
  incoterms?: string | null;
  shipping_cost: number | string;
  valid_until?: string | null;
  general_notes?: string | null;
  lines: ExternalBidLinePayload[];
  quote_attachment?: File | null;
}

export interface ApprovedRequisitionLineOption {
  id: string;
  line_number?: number;
  item_id?: string | null;
  description: string;
  quantity_requested: string | number;
  quantity_quoted?: string | number | null;
  quantity_ordered?: string | number | null;
  uom: string;
  estimated_unit_price?: string | number | null;
  sourcing_status?: string | null;
}

export interface ApprovedRequisitionOption {
  id: string;
  requisition_number: string;
  title?: string;
  status: string;
  urgency?: string;
  required_by_date?: string | null;
  total_estimated_amount?: number;
  currency?: string;
  lines?: ApprovedRequisitionLineOption[];
}

export interface QualifiedSupplierOption {
  id: string;
  supplier_code: string;
  company_name: string;
  vat_number?: string | null;
  status?: string;
  is_approved_vendor?: boolean;
  rating?: string | null;
  currency?: string;
  payment_terms_code?: string | null;
  incoterms?: string | null;
  qualification_status?: string;
  category?: { id: string; code?: string; name: string } | null;
}
