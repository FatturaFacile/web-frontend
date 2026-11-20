import {
  Accuracy,
  ConfidenceBands,
  DailyProjection,
  LiquidityRun,
  PaymentBehavior,
  SkuForecast,
} from './ai-forecasting.models';

/** A projection of `days` days whose p50 balance goes from `start` down by `step` a day. */
export function projections(days: number, start: number, step: number): DailyProjection[] {
  return Array.from({ length: days }, (_, index) => {
    const p50 = start - step * (index + 1);
    const date = new Date(Date.UTC(2028, 0, index + 2)).toISOString().slice(0, 10);

    return {
      date,
      inflows: { p10: 0, p50: 0, p90: 0 },
      outflows: { p10: step, p50: step, p90: step },
      statutory_outflows:
        index === 2
          ? [{ date, nominal_date: date, code: 'F24', category: 'tax' as const, amount: 1000 }]
          : [],
      statutory_total: index === 2 ? 1000 : 0,
      financing_cost: { p10: 0, p50: 0, p90: 0 },
      balance: { p10: p50 - 500, p50, p90: p50 + 500 },
    };
  });
}

export function bandsFixture(overrides: Partial<ConfidenceBands> = {}): ConfidenceBands {
  const days = projections(5, 2000, 500);

  return {
    run_id: 'run-1',
    generated_at: '2028-01-01T03:00:00Z',
    horizon_days: 91,
    currency: 'CHF',
    starting_cash_balance: 2000,
    dates: days.map((day) => day.date),
    p10: days.map((day) => day.balance.p10),
    p50: days.map((day) => day.balance.p50),
    p90: days.map((day) => day.balance.p90),
    statutoryEvents: days.flatMap((day) => day.statutory_outflows),
    keyDrivers: {
      overdue_invoices: [
        {
          invoice_id: 'i-1',
          invoice_number: 'INV-1',
          customer_id: 'c-1',
          customer_name: 'Alpenbau AG',
          due_date: '2027-12-01',
          open_amount: 15000,
          days_overdue: 31,
        },
      ],
      statutory_liabilities: [
        {
          date: '2028-01-04',
          nominal_date: '2028-01-04',
          code: 'F24',
          category: 'tax',
          amount: 1000,
        },
      ],
      customer_delays: [
        {
          customer_id: 'c-1',
          customer_name: 'Alpenbau AG',
          open_amount: 15000,
          predicted_delay_days: 12,
          risk_tier: 'moderate',
          impact: 180000,
        },
      ],
    },
    whatIf: null,
    trough: { date: '2028-01-06', balance: -500 },
    ...overrides,
  };
}

export function runFixture(overrides: Partial<LiquidityRun> = {}): LiquidityRun {
  const days = projections(5, 2000, 500);

  return {
    id: 'run-2',
    generated_at: '2028-01-01T03:10:00Z',
    horizon_days: 91,
    currency: 'CHF',
    starting_cash_balance: 2000,
    trough: { date: '2028-01-06', balance: -2000 },
    daily_projections: days,
    key_drivers: bandsFixture().keyDrivers,
    what_if_parameters: null,
    ...overrides,
  };
}

export function paymentModelFixture(overrides: Partial<PaymentBehavior> = {}): PaymentBehavior {
  return {
    id: 'm-1',
    customer_id: 'c-1',
    customer_name: 'Romandie Retail SA',
    sample_size: 15,
    average_days_late: 38.5,
    std_dev_days_late: 14.2,
    on_time_payment_probability: 0,
    predicted_collection_date_offset_days: 43,
    payment_risk_tier: 'critical',
    last_trained_at: '2028-01-01T03:00:00Z',
    open_invoices: [
      {
        invoice_id: 'i-9',
        invoice_number: 'INV-9',
        due_date: '2028-01-20',
        expected_collection_date: '2028-03-03',
        open_amount: 60000,
      },
    ],
    ...overrides,
  };
}

export function skuForecastFixture(overrides: Partial<SkuForecast> = {}): SkuForecast {
  return {
    forecast_id: 'f-1',
    product_id: 'p-1',
    sku: 'SKU-001',
    product_name: 'Precision housing',
    warehouse_id: 'w-1',
    warehouse_name: 'Main warehouse',
    period_start: '2028-01-01',
    period_end: '2028-01-31',
    predicted_demand_qty: 150,
    confidence_lower_bound: 120,
    confidence_upper_bound: 180,
    current_stock: 300,
    current_reorder_point: 60,
    current_safety_stock: 20,
    recommended_reorder_point: 145.4,
    recommended_safety_stock: 61,
    seasonality_index: 0.8,
    supplier_lead_time_avg_days: 14,
    supplier_lead_time_std_dev_days: 3.5,
    model: 'holt_winters',
    applied_to_wms_at: null,
    history: [
      { month: '2027-11', quantity: 180 },
      { month: '2027-12', quantity: 140 },
    ],
    ...overrides,
  };
}

export function accuracyFixture(): Accuracy {
  return {
    global: { mape: 4.44, wape: 4.4, sample_size: 3 },
    by_warehouse: [],
    by_sku: [],
  };
}
