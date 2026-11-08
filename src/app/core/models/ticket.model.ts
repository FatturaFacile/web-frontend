export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'new' | 'open' | 'pending_customer' | 'on_hold' | 'resolved' | 'closed';
export type TicketType = 'incident' | 'request' | 'problem' | 'change' | 'inquiry';
export type TicketChannel = 'portal' | 'email' | 'phone' | 'chat' | 'api' | 'field';
export type SlaState = 'ok' | 'warning' | 'breached' | 'paused';
export type MessageVisibility = 'public' | 'internal';

export interface TicketAttachment {
  id: string;
  ticket_id?: string;
  message_id?: string;
  filename: string;
  mime_type: string;
  size_bytes?: number;
  url?: string;
  created_at?: string;
}

export interface TicketResource {
  id: string;
  tenant_id: string;
  ticket_number: string;
  type: string;
  subject: string;
  title: string;
  description: string;
  customer_id: string | null;
  contact_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  source: string;
  channel: TicketChannel | string;
  category_id: string | null;
  service_category_id: string | null;
  service_contract_id: string | null;
  sla_policy_id: string | null;
  assigned_technician_id: string | null;
  assigned_to_id: string | null;
  assigned_team_id: string | null;
  service_team_id: string | null;
  requester_user_id: string | null;
  asset_id: string | null;
  response_due_at: string | null;
  resolution_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  is_sla_breached: boolean;
  is_escalated: boolean;
  escalation_level: number;
  is_locked: boolean;
  impact: 'low' | 'medium' | 'high' | null;
  urgency: 'low' | 'medium' | 'high' | null;
  tags: string[];
  first_responded_at: string | null;
  merged_into_ticket_id: string | null;
  split_from_ticket_id: string | null;
  reopened_count: number;
  status_changed_at: string | null;
  sla_paused_at: string | null;
  sla_state: SlaState | string;
  created_at: string | null;
  updated_at: string | null;
}

export interface TicketListMeta {
  current_page: number;
  total: number | string;
  per_page?: number;
  last_page?: number;
}

export interface TicketListResponse {
  data: TicketResource[];
  meta: TicketListMeta;
}

export interface TicketListParams {
  status?: TicketStatus | string;
  priority?: TicketPriority | string;
  source?: string;
  team_id?: string;
  agent_id?: string;
  unassigned?: boolean;
  tag?: string;
  sla_state?: SlaState;
  customer_id?: string;
  q?: string;
  include_merged?: boolean;
  view_id?: string;
  per_page?: number;
  page?: number;
}

export interface StoreTicketRequest {
  title: string;
  description?: string | null;
  customer_id?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  priority?: TicketPriority | null;
  channel?: TicketChannel | null;
  service_category_id?: string | null;
  service_contract_id?: string | null;
  sla_policy_id?: string | null;
  assigned_to_id?: string | null;
  service_team_id?: string | null;
  requester_user_id?: string | null;
  asset_id?: string | null;
  impact?: 'low' | 'medium' | 'high' | null;
  urgency?: 'low' | 'medium' | 'high' | null;
  tags?: string[] | null;
}

export interface UpdateHelpdeskTicketRequest {
  subject?: string;
  description?: string;
  type?: TicketType;
  impact?: 'low' | 'medium' | 'high' | null;
  urgency?: 'low' | 'medium' | 'high' | null;
  priority?: TicketPriority;
  category_id?: string | null;
  customer_id?: string | null;
  service_contract_id?: string | null;
  asset_id?: string | null;
  tags?: string[];
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_name?: string | null;
}

export interface ChangeTicketStatusRequest {
  status: TicketStatus;
  note?: string | null;
}

export interface AssignTicketRequest {
  assigned_to_id: string;
  service_team_id?: string | null;
}

export interface ResolveTicketRequest {
  resolution_notes?: string | null;
  root_cause?: string | null;
  knowledge_article_id?: string | null;
}

export interface HelpdeskTicketMessageResource {
  id: string;
  ticket_id: string;
  author_type: string;
  author_user_id: string | null;
  author_contact_id: string | null;
  author_name: string | null;
  author_email: string | null;
  visibility: MessageVisibility | string;
  channel: string;
  body: string;
  attachments?: TicketAttachment[];
  created_at: string | null;
}

export interface HelpdeskTicketMessagesResponse {
  data: HelpdeskTicketMessageResource[];
  meta: {
    unread: number;
  };
}

export interface StoreTicketMessageRequest {
  body: string;
  visibility?: MessageVisibility | null;
  status?: TicketStatus | null;
  attachments?: File[];
}

export interface HelpdeskTicketActivityResource {
  id: string;
  ticket_id: string;
  type: string;
  from_value: string | null;
  to_value: string | null;
  payload: unknown;
  actor_user_id: string | null;
  created_at: string | null;
}
