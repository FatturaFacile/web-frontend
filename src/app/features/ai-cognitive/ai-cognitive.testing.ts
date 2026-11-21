import { ConfidenceBands } from '../ai-forecasting/ai-forecasting.models';
import { AiSettings, AiSuggestion, PredictiveDashboard } from './ai-cognitive.models';

/** A pending sales quote read from an email: the customer is unknown, so its confidence is low. */
export function suggestionFixture(overrides: Partial<AiSuggestion> = {}): AiSuggestion {
  return {
    id: 's-1',
    kind: 'sales_quote',
    workflow: 'extraction_sales_quote',
    source_type: 'email',
    source_reference: 'mail-1',
    source_text: 'Please send us a quote for two office chairs. Regards, Muster AG',
    proposed_payload: {
      contact_id: null,
      customer: { company_name: 'Muster AG', email: null, vat_number: null },
      currency: 'CHF',
      valid_until: null,
      notes: 'Request by email',
      items: [
        { description: 'Office chair', quantity: 2, unit_price: 100, tax_rate: 8.1, uom: 'PCS' },
      ],
    },
    field_confidences: { customer: 0.5, items: 0.96, currency: 0.99 },
    confidence: 0.5,
    amount: 200,
    reasoning: 'The customer names two chairs.',
    citations: [{ type: 'email', reference: 'mail-1' }],
    status: 'pending',
    priority: 'normal',
    provider_used: 'ollama',
    model_used: 'llama3.3',
    decided_by: null,
    decided_at: null,
    decision_feedback: null,
    final_payload: null,
    resulting_entity_type: null,
    resulting_entity_id: null,
    expires_at: null,
    created_at: '2026-03-05T10:00:00+01:00',
    ...overrides,
  };
}

export function anomalyFixture(overrides: Partial<AiSuggestion> = {}): AiSuggestion {
  return suggestionFixture({
    id: 'a-1',
    kind: 'anomaly',
    workflow: 'anomaly_guard',
    source_type: 'system',
    source_text: null,
    proposed_payload: {
      rule: 'iban_change',
      severity: 'critical',
      subject_type: 'invoice',
      subject_id: 'inv-9',
      details: { invoice_iban: 'CH56*************8009' },
    },
    field_confidences: {},
    confidence: 0.95,
    amount: null,
    reasoning: 'The payment IBAN differs from the supplier master data.',
    priority: 'high',
    ...overrides,
  });
}

export function bandsFixture(overrides: Partial<ConfidenceBands> = {}): ConfidenceBands {
  return {
    run_id: 'run-1',
    generated_at: '2026-03-05T03:20:00+01:00',
    horizon_days: 91,
    currency: 'CHF',
    starting_cash_balance: 5000,
    dates: ['2026-03-05', '2026-03-06', '2026-03-07'],
    p10: [5000, 1500, -2500],
    p50: [6000, 3000, 1200],
    p90: [7000, 4500, 3800],
    statutoryEvents: [],
    keyDrivers: {} as ConfidenceBands['keyDrivers'],
    whatIf: null,
    trough: null,
    ...overrides,
  };
}

export function dashboardFixture(
  overrides: Partial<PredictiveDashboard> = {},
): PredictiveDashboard {
  return {
    cash_flow: bandsFixture(),
    payment_risk: [
      {
        customer_id: 'c-1',
        customer_name: 'Muster AG',
        average_days_late: 34,
        on_time_payment_probability: 0.1,
        payment_risk_tier: 'high',
        predicted_collection_date_offset_days: 34,
      },
    ],
    recommendations: [
      suggestionFixture({
        id: 'r-1',
        kind: 'late_payment_risk',
        workflow: 'predictive_insight',
        source_text: null,
        proposed_payload: { customer_id: 'c-1', risk_tier: 'high', average_days_late: 34 },
        confidence: 0.8,
        priority: 'high',
        reasoning: 'The customer pays on average 34 days late.',
      }),
    ],
    anomalies: [anomalyFixture()],
    ...overrides,
  };
}

export function settingsFixture(overrides: Partial<AiSettings> = {}): AiSettings {
  const defaults = { endpoint: null, model: null, light_model: null, embedding_model: null };

  return {
    external_providers_allowed: false,
    providers: [
      {
        id: 'p-1',
        provider: 'openai',
        label: null,
        is_enabled: true,
        is_default: false,
        is_local: false,
        endpoint: null,
        model: 'gpt-4o',
        light_model: null,
        embedding_model: null,
        has_api_key: true,
        extra: {},
        max_data_classification: 'internal',
        pii_masking_enabled: true,
        latency_sla_ms: null,
        monthly_token_budget: 100000,
        rate_limit_per_minute: null,
      },
    ],
    rules: [
      {
        workflow: 'extraction_sales_quote',
        is_enabled: true,
        auto_approve_enabled: true,
        auto_approve_min_confidence: 0.95,
        max_auto_amount: 1000,
        data_classification: 'confidential_pii',
        preferred_provider: null,
        configured: true,
      },
      {
        workflow: 'anomaly_guard',
        is_enabled: true,
        auto_approve_enabled: false,
        auto_approve_min_confidence: 0.95,
        max_auto_amount: null,
        data_classification: 'internal',
        preferred_provider: null,
        configured: false,
      },
    ],
    supported_providers: [
      {
        provider: 'ollama',
        is_local: true,
        ...defaults,
        endpoint: 'http://localhost:11434',
        model: 'llama3.3',
      },
      { provider: 'openai', is_local: false, ...defaults, model: 'gpt-4o' },
      { provider: 'anthropic', is_local: false, ...defaults },
      { provider: 'gemini', is_local: false, ...defaults },
      { provider: 'azure_openai', is_local: false, ...defaults },
    ],
    data_classifications: ['public', 'internal', 'confidential_pii'],
    ...overrides,
  };
}
