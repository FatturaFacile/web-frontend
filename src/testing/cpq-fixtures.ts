import {
  CpqEvalCharacteristic,
  CpqEvaluation,
  CpqInstance,
  CpqModelRecord,
  CpqProposal,
} from '@core';

/** Builders of CPQ configurator payloads for the specs (the shape the API answers, texts already in the request language). */

export function cpqModel(overrides: Partial<CpqModelRecord> = {}): CpqModelRecord {
  return {
    id: 'm1',
    code: 'PUMP-SKID',
    name: { it: 'Gruppo pompa', en: 'Pump skid' },
    display: 'Pump skid',
    description: { en: 'Skid-mounted pumping unit' },
    currency: 'EUR',
    base_price: '0.0000',
    base_cost: '350.0000',
    base_lead_time_days: 10,
    target_margin_percent: '32.00',
    max_discount_percent: '15.00',
    part_number_prefix: 'PSK',
    part_number_sequence: 0,
    steps: null,
    visual_base: null,
    proposal_texts: null,
    status: 'published',
    version: 1,
    published_at: '2028-01-04T08:00:00Z',
    ...overrides,
  };
}

export function cpqCharacteristic(
  overrides: Partial<CpqEvalCharacteristic> & Pick<CpqEvalCharacteristic, 'code' | 'type'>,
): CpqEvalCharacteristic {
  return {
    step: 'application',
    label: overrides.code,
    help: null,
    unit: null,
    required: true,
    visible: true,
    value: null,
    min: null,
    max: null,
    step_size: null,
    forced: false,
    forced_message: null,
    options: [],
    ...overrides,
  };
}

export function cpqEvaluation(overrides: Partial<CpqEvaluation> = {}): CpqEvaluation {
  const country = cpqCharacteristic({
    code: 'destination_country',
    type: 'list',
    label: 'Destination country',
    value: 'CH',
    options: [
      {
        code: 'IT',
        label: 'Italy',
        description: null,
        disabled: false,
        reasons: [],
        selected: false,
        properties: {},
      },
      {
        code: 'CH',
        label: 'Switzerland',
        description: null,
        disabled: false,
        reasons: [],
        selected: true,
        properties: {},
      },
    ],
  });
  const material = cpqCharacteristic({
    code: 'material',
    type: 'list',
    step: 'hydraulics',
    label: 'Wetted parts material',
    value: 'AISI_316',
    options: [
      {
        code: 'AISI_304',
        label: 'AISI 304',
        description: null,
        disabled: true,
        reasons: ['Acid needs AISI 316'],
        selected: false,
        properties: {},
      },
      {
        code: 'AISI_316',
        label: 'AISI 316',
        description: null,
        disabled: false,
        reasons: [],
        selected: true,
        properties: {},
      },
    ],
  });
  const flow = cpqCharacteristic({
    code: 'flow_rate',
    type: 'range',
    step: 'hydraulics',
    label: 'Flow rate',
    unit: 'm³/h',
    value: 40,
    min: 5,
    max: 120,
    step_size: 5,
  });
  const kit = cpqCharacteristic({
    code: 'safety_kit',
    type: 'boolean',
    step: 'hydraulics',
    label: 'Safety kit',
    required: false,
    value: true,
    forced: true,
    forced_message: 'Mandatory for Switzerland',
  });

  return {
    model: { id: 'm1', code: 'PUMP-SKID', name: 'Pump skid', version: 1, currency: 'EUR' },
    valid: true,
    complete: true,
    missing: [],
    values: { destination_country: 'CH', material: 'AISI_316', flow_rate: 40, safety_kit: true },
    violations: [],
    auto_included: [
      {
        characteristic: 'safety_kit',
        characteristic_label: 'Safety kit',
        value: true,
        value_label: null,
        rule: 'ch-safety-kit',
        message: 'Mandatory for Switzerland',
        overridden: false,
      },
    ],
    steps: [
      {
        code: 'application',
        title: 'Application',
        description: 'Country',
        characteristics: ['destination_country'],
        status: 'complete',
      },
      {
        code: 'hydraulics',
        title: 'Hydraulics',
        description: 'Flow and material',
        characteristics: ['material', 'flow_rate', 'safety_kit'],
        status: 'complete',
      },
    ],
    characteristics: [country, material, flow, kit],
    bom: [
      {
        code: 'frame',
        item_code: 'SKID-FRAME',
        name: 'Skid frame',
        uom: 'PCS',
        quantity: 1,
        unit_cost: 308,
        line_cost: 308,
        lead_time_days: 7,
        auto_include_message: null,
      },
      {
        code: 'safety-kit',
        item_code: 'KIT-SAFETY',
        name: 'Safety kit',
        uom: 'PCS',
        quantity: 1,
        unit_cost: 420,
        line_cost: 420,
        lead_time_days: 6,
        auto_include_message: 'Safety kit required by the configuration.',
      },
    ],
    routing: [
      {
        code: 'assembly',
        operation: 'Mechanical assembly',
        work_center: 'WC-ASM',
        setup_hours: 0.5,
        run_hours: 4.6,
        hours: 5.1,
        hourly_rate: 55,
        cost: 280.5,
      },
    ],
    pricing: {
      components: [
        {
          code: 'cost-plus',
          label: 'Price at 32% target margin',
          effect: 'set_price',
          value: 2500,
        },
      ],
      errors: [],
    },
    totals: {
      currency: 'EUR',
      quantity: 1,
      base_cost: 350,
      bom_cost: 728,
      routing_cost: 280.5,
      industrial_cost: 1358.5,
      list_price: 2000,
      discount_percent: 0,
      selling_price: 2000,
      margin_amount: 641.5,
      margin_percent: 32.08,
      lead_time_days: 18,
      routing_hours: 5.1,
      total_selling_price: 2000,
      target_margin_applied: false,
    },
    visual: {
      base: { shape: 'body', color: '#bfc5cc', label: 'Pump skid', scale_factor: 1 },
      layers: [
        {
          id: 'material',
          characteristic: 'material',
          option: 'AISI_316',
          label: 'AISI 316',
          kind: 'material',
          shape: 'body_finish',
          color: '#9fb3c8',
          z: 10,
          slot: null,
          auto_included: false,
          visible: true,
        },
        {
          id: 'safety_kit',
          characteristic: 'safety_kit',
          option: null,
          label: 'Safety kit',
          kind: 'safety',
          shape: 'kit',
          color: '#fadb14',
          z: 40,
          slot: null,
          auto_included: true,
          visible: true,
        },
      ],
      views: ['plan', 'elevation', 'isometric'],
    },
    configuration_hash: 'a'.repeat(64),
    part_number_preview: 'PSK-S6-400-B-Q40-H30-SK-CH-####',
    deduplication: { hash: 'a'.repeat(64), existing: false, part_number: null, instance_id: null },
    ...overrides,
  };
}

export function cpqInstance(overrides: Partial<CpqInstance> = {}): CpqInstance {
  return {
    id: 'i1',
    model_id: 'm1',
    model_version: 1,
    configuration_hash: 'a'.repeat(64),
    part_number: 'PSK-S6-400-B-Q40-H30-SK-CH-0001',
    configuration: { model: 'm1', version: 1, values: { flow_rate: '40' } },
    currency: 'EUR',
    list_price: '2000.0000',
    selling_price: '2000.0000',
    lead_time_days: 18,
    status: 'confirmed',
    mfg_item_id: null,
    mfg_bom_id: null,
    customer_reference: 'ACME',
    reuse_count: 0,
    confirmed_at: '2028-01-04T09:00:00Z',
    created_at: '2028-01-04T09:00:00Z',
    ...overrides,
  };
}

export function cpqProposal(overrides: Partial<CpqProposal['dossier']> = {}): CpqProposal {
  return {
    html: '<html></html>',
    dossier: {
      document: {
        reference: 'PSK-S6-400-B-Q40-H30-SK-CH-0001',
        generated_at: '2028-01-04T09:00:00Z',
        valid_days: 30,
        locale: 'en',
        currency: 'EUR',
        customer: 'ACME',
        confirmed: true,
      },
      product: {
        model_code: 'PUMP-SKID',
        model_name: 'Pump skid',
        description: null,
        part_number: 'PSK-S6-400-B-Q40-H30-SK-CH-0001',
        version: 1,
        hash: 'a'.repeat(64),
      },
      texts: {
        title: 'Technical and commercial proposal',
        intro: 'Below the configuration.',
        warranty: 'Two years.',
        terms: 'EXW prices.',
        delivery: 'After order confirmation.',
        installation: 'Flat base.',
      },
      specification: [
        {
          step: 'Hydraulics',
          rows: [
            { label: 'Flow rate', value: '40', unit: 'm³/h', auto_included: false },
            { label: 'Safety kit', value: '✓', unit: null, auto_included: true },
          ],
        },
      ],
      auto_included: [
        {
          characteristic_label: 'Safety kit',
          value_label: null,
          message: 'Mandatory for Switzerland',
        },
      ],
      visual: { layers: [] },
      dimensional_notes: ['Footprint 1.6 × 0.8 m'],
      bom: [{ item_code: 'SKID-FRAME', name: 'Skid frame', quantity: 1, uom: 'PCS' }],
      commercial: {
        quantity: 2,
        list_price: 2000,
        discount_percent: 0,
        unit_price: 2000,
        total_price: 4000,
        lead_time_days: 18,
      },
      breakdown: null,
      ...overrides,
    },
  };
}
