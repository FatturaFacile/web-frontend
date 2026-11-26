import { toDayKey } from '@shared/utils/date-validators';

export const DELEGATION_SCOPES = ['all', 'procurement', 'expenses', 'invoicing', 'hr', 'custom'] as const;
export type DelegationScope = (typeof DELEGATION_SCOPES)[number];

export interface DelegationDraft {
  delegateUserId: string | null;
  scope: DelegationScope;
  /** The two ends of the range picker (null while it is empty). */
  range: [Date, Date] | null;
  documentTypes: string[];
  amountCap: number | null;
  reason: string;
}

export const EMPTY_DELEGATION: DelegationDraft = {
  delegateUserId: null,
  scope: 'all',
  range: null,
  documentTypes: [],
  amountCap: null,
  reason: '',
};

/** Translation key of the first problem of the draft (the delegate must be someone else, the end not before the start), or null. */
export function delegationProblem(draft: DelegationDraft, ownUserId: string | null | undefined): string | null {
  if (!draft.delegateUserId) {
    return 'workflows.delegations.error.delegateRequired';
  }
  if (ownUserId && draft.delegateUserId === ownUserId) {
    return 'workflows.delegations.error.self';
  }
  if (!draft.range) {
    return 'workflows.delegations.error.periodRequired';
  }
  const from = toDayKey(draft.range[0]);
  const to = toDayKey(draft.range[1]);
  if (!from || !to) {
    return 'workflows.delegations.error.periodRequired';
  }
  if (to < from) {
    return 'workflows.delegations.error.periodOrder';
  }
  if (draft.amountCap !== null && draft.amountCap <= 0) {
    return 'workflows.delegations.error.cap';
  }
  return null;
}

/** Body of the create request: dates as `Y-m-d`, the optional limits only when set. */
export function delegationPayload(draft: DelegationDraft): {
  delegate_user_id: string;
  scope: string;
  starts_at: string;
  ends_at: string;
  document_types?: string[];
  amount_cap?: number;
  reason?: string;
} {
  const reason = draft.reason.trim();
  return {
    delegate_user_id: draft.delegateUserId ?? '',
    scope: draft.scope,
    starts_at: toDayKey(draft.range?.[0]) ?? '',
    ends_at: toDayKey(draft.range?.[1]) ?? '',
    ...(draft.documentTypes.length > 0 ? { document_types: draft.documentTypes } : {}),
    ...(draft.amountCap !== null ? { amount_cap: draft.amountCap } : {}),
    ...(reason !== '' ? { reason } : {}),
  };
}
