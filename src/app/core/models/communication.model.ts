export type CommunicationChannelType = 'email' | 'whatsapp' | 'telegram' | 'sms';
export type CommunicationDriverType = 'mail' | 'smtp' | 'twilio' | 'telegram' | 'local';
export type CommunicationDeliveryStatus = 'sent' | 'simulated' | 'failed';

export interface CommunicationDeliveryLog {
  id: string;
  message_type: 'document' | 'message';
  channel: CommunicationChannelType;
  driver?: string;
  document_type?: 'invoice' | 'quote' | null;
  document_id?: string | null;
  template_code?: string | null;
  locale?: string | null;
  recipient: string;
  subject?: string | null;
  status: CommunicationDeliveryStatus;
  provider_reference?: string | null;
  error?: string | null;
  sent_by?: string | null;
  created_at: string;
}

export interface CommunicationChannelResource {
  id: string;
  channel: CommunicationChannelType;
  driver: CommunicationDriverType;
  is_enabled: boolean;
  has_credentials: boolean;
  settings?: Record<string, unknown>;
  secrets_set?: string[];
}

export interface CommunicationUpdateChannelRequest {
  driver: CommunicationDriverType;
  is_enabled?: boolean;
  credentials?: Record<string, unknown> | null;
}

export interface CommunicationTemplateResource {
  id: string;
  code: string;
  channel: CommunicationChannelType;
  locale: string;
  subject?: string | null;
  body: string;
  is_active: boolean;
  placeholders?: string[];
}

export interface CommunicationSaveTemplateRequest {
  code: string;
  channel: CommunicationChannelType;
  locale: string;
  subject?: string | null;
  body: string;
  is_active?: boolean;
}

export interface CommunicationSendMessageRequest {
  channel: CommunicationChannelType;
  recipient: string;
  template_code: string;
  locale?: string;
  variables?: Record<string, string>;
}

export interface CommunicationSendDocumentRequest {
  document_type: 'invoice' | 'quote';
  document_id: string;
  channel: CommunicationChannelType;
  recipient?: string | null;
  message?: string | null;
  locale?: string | null;
}

export interface CommunicationTestChannelRequest {
  recipient: string;
}

export interface CommunicationPreviewTemplateRequest {
  variables?: Record<string, string>;
}

export interface CommunicationPreviewResponse {
  subject?: string;
  body: string;
  rendered_variables?: Record<string, string>;
}
