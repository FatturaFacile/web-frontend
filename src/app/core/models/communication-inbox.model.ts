import { CommunicationChannelType } from './communication.model';

export type CommunicationConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type CommunicationCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
export type CommunicationCampaignPurpose = 'marketing' | 'newsletter';
export type CommunicationRecipientStatus = 'pending' | 'sent' | 'failed' | 'suppressed';

export interface CommunicationConversationMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  channel: CommunicationChannelType;
  sender_address: string | null;
  sender_user_id: string | null;
  body: string;
  delivery_log_id: string | null;
  delivery_status: 'sent' | 'simulated' | 'failed' | null;
  occurred_at: string;
}

export interface CommunicationConversation {
  id: string;
  channel: CommunicationChannelType;
  counterparty_address: string;
  counterparty_name: string | null;
  contact_id: string | null;
  subject: string | null;
  status: CommunicationConversationStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  unread_count: number;
  last_message_at: string | null;
  resolved_at: string | null;
  messages?: CommunicationConversationMessage[];
  created_at: string;
}

export interface CommunicationConversationFilterParams {
  status?: CommunicationConversationStatus;
  channel?: CommunicationChannelType;
  assigned_to?: string;
  unread?: boolean;
  page?: number;
  per_page?: number;
}

/** API `InboundMessageRequest`. */
export interface CommunicationInboundMessageRequest {
  channel: CommunicationChannelType;
  address: string;
  name?: string | null;
  subject?: string | null;
  body: string;
  received_at?: string | null;
}

export interface CommunicationCampaign {
  id: string;
  name: string;
  channel: CommunicationChannelType;
  purpose: CommunicationCampaignPurpose;
  segment_id: string | null;
  subject: string | null;
  body: string;
  status: CommunicationCampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  suppressed_count: number;
  created_at: string;
  updated_at: string;
}

/** API `CampaignRequest`. */
export interface CommunicationCampaignRequest {
  name: string;
  channel: CommunicationChannelType;
  purpose?: CommunicationCampaignPurpose;
  segment_id?: string | null;
  subject?: string | null;
  body: string;
}

export interface CommunicationCampaignPreview {
  total: number;
  deliverable: number;
  suppressed: Record<string, number>;
}

export interface CommunicationCampaignRecipient {
  id: string;
  contact_id: string | null;
  lead_id: string | null;
  address: string | null;
  status: CommunicationRecipientStatus;
  suppression_reason: string | null;
  delivery_log_id: string | null;
  error: string | null;
  sent_at: string | null;
}

export interface CommunicationContactPreference {
  channel: CommunicationChannelType;
  is_opted_out: boolean;
  reason: string | null;
  changed_at: string | null;
  marketing_consent: 'granted' | 'withdrawn' | null;
  can_receive_marketing: boolean;
}

/** API `ContactPreferenceRequest`. */
export interface CommunicationContactPreferenceRequest {
  channel: CommunicationChannelType;
  is_opted_out: boolean;
  reason?: string | null;
}

/** Member of the company a conversation can be assigned to. */
export interface CommunicationAssignee {
  id: string;
  name: string;
}
