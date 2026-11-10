import { TicketPriority, TicketStatus } from './ticket.model';

export type AssignmentStrategy = 'manual' | 'round_robin' | 'least_loaded';
export type AutoAssignStrategy = 'round_robin' | 'least_loaded';
export type BulkTicketAction = 'status' | 'priority' | 'assign' | 'add_tags' | 'remove_tags' | 'macro';

export interface BulkTicketRequest {
  ticket_ids: string[];
  action: BulkTicketAction;
  status?: TicketStatus | null;
  priority?: TicketPriority | null;
  assigned_team_id?: string | null;
  assigned_technician_id?: string | null;
  tags?: string[];
  macro_id?: string | null;
}

export interface BulkTicketOutcome {
  ticket_id: string;
  ok: boolean;
  error: string | null;
}

export interface BulkTicketResponse {
  data: BulkTicketOutcome[];
  meta: { succeeded: number; failed: number };
}

export interface MergeTicketRequest {
  target_ticket_id: string;
}

export interface SplitTicketRequest {
  subject: string;
  message_ids: string[];
}

export interface AutoAssignRequest {
  team_id?: string | null;
  strategy: AutoAssignStrategy;
}

export interface TicketWatcher {
  id: string;
  ticket_id: string;
  user_id: string;
  name?: string;
  created_at: string | null;
}

export interface TicketReadState {
  last_read_at: string;
  unread: number;
}

export interface CannedResponse {
  id: string;
  title: string;
  category: string | null;
  body: string;
  is_shared: boolean;
  owner_user_id: string | null;
  created_at: string | null;
}

export interface MacroActions {
  set_status?: string;
  set_priority?: string;
  assign_team_id?: string | null;
  assign_technician_id?: string | null;
  add_tags?: string[];
  remove_tags?: string[];
  reply?: { body: string; visibility?: 'public' | 'internal' };
}

export interface Macro {
  id: string;
  name: string;
  description: string | null;
  actions: MacroActions;
  is_shared: boolean;
  owner_user_id: string | null;
  created_at: string | null;
}

export interface RenderedCannedResponse {
  body: string;
}

export type KnowledgeVisibility = 'internal' | 'public';

export interface KnowledgeArticle {
  id: string;
  article_number: string;
  title: string;
  summary: string | null;
  content: string;
  knowledge_category_id: string | null;
  category_id: string | null;
  visibility: KnowledgeVisibility | string;
  is_published: boolean;
  published_at: string | null;
  current_version: number;
  tags: string[];
  views_count: number;
  helpful_count: number;
  author_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface KnowledgeArticleParams {
  q?: string;
  visibility?: KnowledgeVisibility;
  knowledge_category_id?: string;
  is_published?: boolean;
  page?: number;
}

export interface HelpdeskNotification {
  id: string;
  ticket_id: string | null;
  event: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string | null;
}

export interface HelpdeskNotificationsResponse {
  data: HelpdeskNotification[];
  meta: { unread: number };
}
