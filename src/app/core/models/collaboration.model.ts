/** Collaboration: global search, comments with mentions, shared tags and record activity. Mirrors the API FormRequests and Resources of the Collaboration module. */

/** Key of a record type registered by the API (contact, invoice, quote, product, project, supplier, employee, ...). */
export type CollaborationRecordTypeKey = string;

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface CollaborationResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface CollaborationSearchResult {
  type: CollaborationRecordTypeKey;
  type_label: string;
  id: string;
  title: string;
  subtitle: string | null;
  /** Frontend route of the record. */
  path: string;
}

export interface CollaborationSearchFilters {
  q: string;
  types?: CollaborationRecordTypeKey[];
  limit?: number;
}

export interface CollaborationRecordType {
  key: CollaborationRecordTypeKey;
  label: string;
}

export interface CollaborationMentionableUser {
  id: string;
  name: string;
  email: string;
}

export interface CollaborationComment {
  id: string;
  record_type: CollaborationRecordTypeKey;
  record_id: string;
  body: string;
  mentions: string[];
  author: { id: string; name: string | null };
  can_edit: boolean;
  can_delete: boolean;
  edited_at: string | null;
  created_at: string;
}

export interface CollaborationCommentRequest {
  body: string;
  mentions?: string[];
}

export interface CollaborationTag {
  id: string;
  name: string;
  color: string | null;
  usage_count: number | null;
  created_at: string;
}

export interface CollaborationTagRequest {
  name: string;
  color?: string | null;
}

/** Either `tag_id` or `name` is required. */
export interface CollaborationAttachTagRequest {
  tag_id?: string | null;
  name?: string | null;
}

export type CollaborationActivityAction = 'CREATED' | 'UPDATED' | 'DELETED';

export interface CollaborationActivity {
  id: string;
  action: CollaborationActivityAction | string;
  module_code: string | null;
  actor: { id: string; name: string | null } | null;
  changed_fields: string[];
  occurred_at: string;
}
