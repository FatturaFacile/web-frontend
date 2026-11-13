export interface SubscriptionPlanTier {
  from_quantity: number;
  to_quantity?: number | null;
  unit_price: number;
  flat_fee?: number | null;
}

export interface SubscriptionPlanFeature {
  feature_code: string;
  name: string;
  metric_type?: 'boolean' | 'metered_quota' | 'unlimited' | null;
  included_quantity?: number | null;
}

export interface SubscriptionPlanResource {
  id: string;
  plan_code: string;
  name: string;
  description: string | null;
  product_id: string | null;
  billing_interval: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  interval_count: number | null;
  billing_alignment: 'anniversary' | 'calendar' | null;
  pricing_model: 'flat_fee' | 'per_unit' | 'per_seat' | 'tiered' | 'volume' | 'metered' | 'hybrid' | null;
  currency: string;
  setup_fee: string | null;
  base_price: string;
  tax_rate: string | null;
  trial_period_days: number | null;
  min_commitment_cycles: number | null;
  is_active: boolean;
  tiers?: SubscriptionPlanTier[];
  features?: SubscriptionPlanFeature[];
  created_at: string | null;
  updated_at: string | null;
}

export interface CreatePlanPayload {
  plan_code: string;
  name: string;
  description?: string | null;
  product_id?: string | null;
  billing_interval: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  interval_count?: number | null;
  pricing_model?: 'flat_fee' | 'per_unit' | 'per_seat' | 'tiered' | 'volume' | 'metered' | 'hybrid' | null;
  currency?: string | null;
  base_price: number;
  setup_fee?: number | null;
  tax_rate?: number | null;
  trial_period_days?: number | null;
}

export interface SubscriptionContractItem {
  id?: string;
  item_type?: 'addon' | 'support_retainer' | 'hardware_lease' | 'charge' | 'usage_meter' | null;
  description?: string;
  quantity?: number | null;
  unit_price?: number | null;
  discount_percentage?: number | null;
  tax_rate?: number | null;
}

export interface SubscriptionContractResource {
  id: string;
  subscription_number: string;
  name: string | null;
  customer_id: string;
  customer_name?: string | null;
  plan_id: string;
  plan_name?: string | null;
  status: string;
  currency: string;
  mrr: string;
  arr: string;
  unit_price: string;
  quantity: number;
  start_date: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end_date: string | null;
  cancelled_at: string | null;
  paused_at: string | null;
  next_billing_date: string | null;
  auto_renew: boolean;
  payment_method: string | null;
  items?: SubscriptionContractItem[];
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateSubscriptionPayload {
  customer_id: string;
  plan_id: string;
  name?: string | null;
  start_date: string;
  quantity?: number | null;
  trial_days?: number | null;
  auto_renew?: boolean | null;
  payment_method?: 'sepa_direct_debit' | 'bank_transfer' | 'credit_card' | 'cash' | null;
  notes?: string | null;
}

export interface SubscriptionMetrics {
  as_of: string;
  window_start: string;
  window_days: number;
  mrr: string;
  arr: string;
  active_subscriptions: number;
  trialing_subscriptions: number;
  paying_customers: number;
  net_new_mrr: string;
  customer_churn_rate: string;
  revenue_churn_rate: string;
  arpa: string;
  ltv: string | null;
}

export interface DunningPolicyResource {
  max_retries: number;
  retry_interval_days: number[];
  action_on_final_failure: 'cancel' | 'suspend' | 'mark_uncollectible';
}
