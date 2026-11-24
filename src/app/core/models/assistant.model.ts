import { QueryFilterParams } from './api.models';

export type AssistantOutcome = 'answered' | 'unmatched' | 'forbidden' | 'failed';
export type AssistantFeedbackRating = 'helpful' | 'not_helpful';

export interface AskAssistantRequest {
  question: string;
  thread_id?: string | null;
}

export interface AssistantAnswer {
  outcome: AssistantOutcome;
  query?: string | null;
  description?: string | null;
  parameters?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
  thread_id?: string;
  log_id?: string;
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
  thread_id?: string | null;
  feedback?: AssistantFeedbackRating | null;
  feedback_comment?: string | null;
  created_at: string;
}

export interface AssistantLogQueryParams extends QueryFilterParams {
  outcome?: AssistantOutcome;
  user_id?: string;
  from?: string;
  to?: string;
}

/** A conversation of the user; `messages` (the questions asked, oldest first) is present on the detail only. */
export interface AssistantThread {
  id: string;
  title: string;
  last_message_at: string | null;
  created_at: string;
  messages?: AssistantLogResource[];
}
