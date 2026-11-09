export type AssistantOutcome = 'answered' | 'unmatched' | 'forbidden' | 'failed';

export interface AskAssistantRequest {
  question: string;
}

export interface AssistantAnswer {
  outcome: AssistantOutcome;
  query?: string | null;
  description?: string | null;
  parameters?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
}

export interface AssistantCatalogueEntry {
  key: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface AssistantLogResource {
  id: string;
  user_id: string;
  role?: string | null;
  question: string;
  resolver: string;
  query_key?: string | null;
  parameters?: Record<string, unknown>;
  outcome: AssistantOutcome | string;
  row_count: number;
  created_at: string;
}

export interface AssistantLogQueryParams {
  per_page?: number;
  outcome?: AssistantOutcome;
  user_id?: string;
  from?: string;
  to?: string;
}
