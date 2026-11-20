export type CopilotLocale = 'it' | 'de' | 'fr' | 'en';
export type CopilotRole = 'user' | 'assistant' | 'system' | 'tool';
export type CopilotActionStatus = 'pending' | 'confirmed' | 'rejected' | 'executed' | 'failed';

export interface CopilotContext {
  route: string;
  entity_type: string | null;
  entity_id: string | null;
  /** Human readable label of the entity shown in the context badge (never sent to the API). */
  label?: string | null;
}

export interface RegulatoryCitation {
  type: 'regulatory';
  label: string;
  title?: string | null;
  section_ref?: string | null;
  jurisdiction?: string | null;
}

export interface EntityCitation {
  type: 'entity';
  label: string;
  entity_type: string;
  entity_id: string;
  route: string | null;
}

export type CopilotCitation = RegulatoryCitation | EntityCitation;

export type CopilotVisualizationType = 'bar' | 'line' | 'pie' | 'kpi_card' | 'table';

export interface CopilotVisualization {
  type: CopilotVisualizationType;
  title: string;
  columns: string[];
  rows: Record<string, unknown>[];
  x?: string;
  labels?: string[];
  datasets?: { name: string; data: number[] }[];
  metric?: string;
  value?: number | string;
}

export interface CopilotActionResult {
  label?: string;
  route?: string | null;
  [key: string]: unknown;
}

export interface CopilotProposedAction {
  tool: string;
  module: string;
  status: string;
  summary: string;
  arguments: Record<string, unknown>;
  details: Record<string, unknown>;
  editable_fields: string[];
  result?: CopilotActionResult | null;
  error?: string | null;
}

export interface CopilotMessage {
  id: string;
  conversation_id: string;
  role: CopilotRole;
  content_markdown: string;
  citations: CopilotCitation[];
  visualization: CopilotVisualization | null;
  proposed_action: CopilotProposedAction | null;
  action_status: CopilotActionStatus | null;
  token_usage?: unknown;
  created_at: string;
  /** Client-only: message is still being streamed. */
  streaming?: boolean;
}

export interface CopilotConversation {
  id: string;
  title: string | null;
  locale?: string | null;
  context_route?: string | null;
  context_entity_type?: string | null;
  context_entity_id?: string | null;
  messages?: CopilotMessage[];
  created_at?: string;
  updated_at?: string;
}

export interface CopilotEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: unknown;
}

export type CopilotStreamEvent =
  | { event: 'message.started'; data: Record<string, unknown> }
  | { event: 'tool.call'; data: Record<string, unknown> }
  | { event: 'tool.result'; data: Record<string, unknown> }
  | { event: 'visualization'; data: CopilotVisualization }
  | { event: 'action.proposed'; data: CopilotProposedAction }
  | { event: 'token'; data: { text: string } }
  | { event: 'message.completed'; data: { message_id: string; conversation_id: string } }
  | { event: 'error'; data: { message: string } };

export interface CopilotSseFrame {
  event: string;
  data: unknown;
}

/** Error raised by the Copilot API with the HTTP status for localized messages. */
export class CopilotApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CopilotApiError';
  }
}
