/** Product lifecycle management. Mirrors the API FormRequests and resources of the PLM module. */

export type PlmChangeStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'implemented' | 'cancelled';
export type PlmChangeType = 'design' | 'material' | 'process' | 'documentation';
export type PlmPriority = 'low' | 'normal' | 'high' | 'critical';
export type PlmApprovalStatus = 'pending' | 'approved' | 'rejected';
export type PlmRevisionStatus = 'draft' | 'released' | 'obsolete';
export type PlmDecision = 'approve' | 'reject';

export const PLM_CHANGE_STATUSES: readonly PlmChangeStatus[] = ['draft', 'in_review', 'approved', 'rejected', 'implemented', 'cancelled'];
export const PLM_CHANGE_TYPES: readonly PlmChangeType[] = ['design', 'material', 'process', 'documentation'];
export const PLM_PRIORITIES: readonly PlmPriority[] = ['low', 'normal', 'high', 'critical'];
export const PLM_REVISION_STATUSES: readonly PlmRevisionStatus[] = ['draft', 'released', 'obsolete'];

export interface PlmApproval {
  id: string;
  approver_id: string;
  approver_name: string | null;
  sequence: number;
  status: PlmApprovalStatus;
  decided_at: string | null;
  comment: string | null;
}

export interface PlmAffectedItem {
  id: string;
  mfg_item_id: string;
  item_code: string | null;
  item_name: string | null;
  to_revision: string;
  change_summary: string | null;
}

export interface PlmAffectedBom {
  id: string;
  bom_id: string;
  bom_number: string | null;
  bom_name: string | null;
  bom_revision: string | null;
  bom_status: string | null;
  note: string | null;
}

export interface PlmChangeOrder {
  id: string;
  code: string;
  title: string;
  reason: string;
  change_type: PlmChangeType;
  priority: PlmPriority;
  status: PlmChangeStatus;
  requested_by: string | null;
  effective_date: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  implemented_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  approvals?: PlmApproval[];
  affected_items?: PlmAffectedItem[];
  affected_boms?: PlmAffectedBom[];
}

export interface PlmChangeOrderRequest {
  code: string;
  title: string;
  reason: string;
  change_type?: PlmChangeType;
  priority?: PlmPriority;
  effective_date?: string | null;
  notes?: string | null;
  approvers?: string[];
  affected_items?: { mfg_item_id: string; to_revision: string; change_summary?: string | null }[];
  affected_boms?: { bom_id: string; note?: string | null }[];
}

export interface PlmChangeOrderFilters {
  status?: PlmChangeStatus;
  priority?: PlmPriority;
  change_type?: PlmChangeType;
  search?: string;
  awaiting_me?: boolean;
  per_page?: number;
}

export interface PlmDecisionRequest {
  decision: PlmDecision;
  comment?: string | null;
}

export interface PlmItemRevision {
  id: string;
  mfg_item_id: string;
  item?: { id: string; item_code: string; name: string } | null;
  revision: string;
  status: PlmRevisionStatus;
  change_summary: string | null;
  change_order_id: string | null;
  effective_from: string | null;
  released_at: string | null;
  obsoleted_at: string | null;
}

export interface PlmItemRevisionRequest {
  mfg_item_id?: string;
  revision: string;
  change_summary?: string | null;
  effective_from?: string | null;
}

export interface PlmItemRevisionFilters {
  mfg_item_id?: string;
  status?: PlmRevisionStatus;
  per_page?: number;
}

/** A manufacturing item or bill of material offered in a select. */
export interface PlmOption {
  id: string;
  label: string;
}

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface PlmResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
