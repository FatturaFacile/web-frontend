/** Subscription lifecycle changes, usage billing, billing runs and revenue recognition. */

export interface SubscriptionPlanChangePayload {
  new_plan_id: string;
  quantity?: number | string | null;
  effective_date?: string | null;
  change_reason?: string | null;
}

export interface SubscriptionQuantityPayload {
  quantity: number | string;
  effective_date?: string | null;
  reason?: string | null;
}

export interface ProrationPreviewParams {
  new_plan_id?: string | null;
  quantity?: number | string | null;
  effective_date?: string | null;
}

export type ProrationPreview = Record<string, unknown>;

export interface SubscriptionSuspendPayload {
  reason?: string | null;
  resume_on?: string | null;
}

export interface CollectionFailurePayload {
  invoice_id: string;
  reason?: string | null;
}

export interface SubscriptionDunningCase {
  id: string;
  invoice_id?: string | null;
  status?: string | null;
  level?: number | null;
  [key: string]: unknown;
}

export interface UsageEventPayload {
  subscription_item_id: string;
  metric_code: string;
  quantity: number | string;
  event_timestamp?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UsageEvent {
  id: string;
  subscription_item_id?: string;
  metric_code?: string;
  quantity?: string;
  event_timestamp?: string | null;
  [key: string]: unknown;
}

export interface SubscriptionBillingRunPayload {
  run_date?: string | null;
  lookahead_days?: number | null;
  subscription_id?: string | null;
}

export interface SubscriptionBillingRun {
  id: string;
  status?: string | null;
  run_date?: string | null;
  invoices_created?: number | null;
  errors?: unknown[];
  [key: string]: unknown;
}

export interface RevenueContract {
  id: string;
  status?: string | null;
  obligations?: unknown[];
  [key: string]: unknown;
}

export type SubscriptionRevenueForecast = Record<string, unknown>;
