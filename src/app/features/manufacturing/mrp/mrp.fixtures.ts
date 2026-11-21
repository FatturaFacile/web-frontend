import {
  MrpGantt,
  MrpGanttBucket,
  MrpPegging,
  MrpProposal,
  MrpProposalType,
  MrpRun,
  MrpRunDetail,
} from './mrp.models';

/** Test data shared by the specs of the MRP feature. */

export function proposal(overrides: Partial<MrpProposal> & Pick<MrpProposal, 'id'>): MrpProposal {
  return {
    mrp_run_id: 'run-1',
    product_id: null,
    mfg_item_id: 'item-1',
    item_code: `ITEM-${overrides.id}`,
    item_name: 'Item name',
    bom_version_id: null,
    work_center_id: null,
    low_level_code: 0,
    proposal_type: 'PlannedPurchaseRequisition',
    status: 'Proposed',
    gross_requirement_qty: '25.0000',
    projected_on_hand_qty: '5.0000',
    net_requirement_qty: '20.0000',
    required_qty: '20.0000',
    suggested_order_qty: '24.0000',
    need_by_date: '2027-03-10',
    release_order_by_date: '2027-03-01',
    planned_start_at: null,
    planned_end_at: null,
    pegged_demand_source_ids: [],
    exception_messages: [],
    supply_reference: null,
    firm_reference_type: null,
    firm_reference_id: null,
    firmed_at: null,
    released_at: null,
    ...overrides,
  };
}

export const typed = (id: string, proposalType: MrpProposalType, extra: Partial<MrpProposal> = {}): MrpProposal =>
  proposal({ id, proposal_type: proposalType, ...extra });

export const RUN: MrpRun = {
  id: 'run-1',
  run_code: 'MRP-2027-0001',
  status: 'Completed',
  run_mode: 'RegenerativeFull',
  planning_horizon_days: 90,
  capacity_scheduling_mode: 'FiniteCapacityConstraint',
  scheduling_direction: 'BackwardFromDueDate',
  include_cross_border_customs_lead_time: false,
  apply_supplier_shutdown_calendars: false,
  started_at: '2027-03-01T08:00:00+01:00',
  completed_at: '2027-03-01T08:00:02+01:00',
  execution_duration_ms: 1840,
  summary_metrics: {
    items_planned: 12,
    max_low_level_code: 3,
    proposals_total: 4,
    proposals_by_type: { PlannedPurchaseRequisition: 2 },
    exceptions_by_code: { Expedite: 1 },
    overloaded_buckets: 1,
    max_load_percentage: '166.67',
    kept_proposals: 0,
    firm_carried_over: 0,
  },
  error_message: null,
};

export const DETAIL: MrpRunDetail = {
  run: RUN,
  kpis: {
    proposals_total: 4,
    by_type: { PlannedPurchaseRequisition: 2, PlannedProductionOrder: 1, RescheduleIn_Expedite: 1 },
    by_status: { Proposed: 4 },
    by_exception: { Expedite: 1, CapacityOverload: 1 },
    capacity_buckets: 8,
    overloaded_buckets: 1,
    overloaded_work_centers: 1,
    max_load_percentage: '166.67',
    execution_duration_ms: 1840,
  },
};

export const PEGGING: MrpPegging = {
  proposal: {
    id: 'p-top',
    item_id: 'i-top',
    item_code: 'FRAME',
    item_name: 'Frame',
    proposal_type: 'PlannedProductionOrder',
    status: 'Proposed',
    quantity: '10.0000',
    need_by_date: '2027-03-10',
  },
  upstream: [
    { type: 'sales_order_line', id: 'sol-1', quantity: '6.0000', proposal: null, upstream: [] },
    {
      type: 'mrp_proposal',
      id: 'p-parent',
      quantity: '4.0000',
      proposal: {
        id: 'p-parent',
        item_id: 'i-bike',
        item_code: 'BIKE',
        item_name: 'Bike',
        proposal_type: 'PlannedProductionOrder',
        status: 'Firm',
        quantity: '4.0000',
        need_by_date: '2027-03-12',
      },
      upstream: [{ type: 'mps_line', id: 'mps-1', quantity: '4.0000', proposal: null, upstream: [] }],
    },
  ],
  downstream: [
    {
      id: 'p-tube',
      item_id: 'i-tube',
      item_code: 'TUBE',
      item_name: 'Tube',
      proposal_type: 'PlannedPurchaseRequisition',
      status: 'Proposed',
      quantity: '30.0000',
      need_by_date: '2027-03-05',
      children: [
        {
          id: 'p-steel',
          item_id: 'i-steel',
          item_code: 'STEEL',
          item_name: 'Steel',
          proposal_type: 'PlannedPurchaseRequisition',
          status: 'Proposed',
          quantity: '60.0000',
          need_by_date: '2027-03-01',
          children: [],
        },
      ],
    },
  ],
  root_demands: [
    { type: 'sales_order_line', id: 'sol-1', quantity: '6.0000' },
    { type: 'mps_line', id: 'mps-1', quantity: '4.0000' },
  ],
};

export const bucket = (date: string, shift: string, loaded: number, available: number, pct: string): MrpGanttBucket => ({
  bucket_date: date,
  shift_code: shift,
  available_minutes: available,
  loaded_minutes: loaded,
  load_percentage: pct,
  is_overloaded: Number(pct) > 100,
  assigned_proposal_ids: [],
});

export const GANTT: MrpGantt = {
  run_id: 'run-1',
  from: '2027-03-01',
  to: '2027-03-07',
  work_centers: [
    {
      id: 'wc-a',
      code: 'WELD',
      name: 'Welding',
      alternative_work_center_ids: ['wc-b'],
      buckets: [
        bucket('2027-03-01', 'DAY', 500, 300, '166.67'),
        bucket('2027-03-02', 'DAY', 150, 300, '50.00'),
      ],
      blocks: [
        {
          id: 'blk-1',
          proposal_id: 'p-1',
          item_code: 'FRAME',
          item_name: 'Frame',
          proposal_status: 'Proposed',
          exception_messages: ['CapacityOverload'],
          operation_sequence: 10,
          start_date: '2027-03-01',
          end_date: '2027-03-02',
          minutes: 650,
          segments: [{ date: '2027-03-01', minutes: 500 }],
          is_manual: false,
          original_work_center_id: null,
        },
        {
          id: 'blk-2',
          proposal_id: 'p-2',
          item_code: 'FORK',
          item_name: 'Fork',
          proposal_status: 'Firm',
          exception_messages: [],
          operation_sequence: 10,
          start_date: '2027-03-04',
          end_date: '2027-03-04',
          minutes: 120,
          segments: [],
          is_manual: true,
          original_work_center_id: 'wc-b',
        },
      ],
    },
    {
      id: 'wc-b',
      code: 'PAINT',
      name: 'Paint shop',
      alternative_work_center_ids: ['wc-a'],
      buckets: [bucket('2027-03-01', 'DAY', 60, 300, '20.00')],
      blocks: [],
    },
    {
      id: 'wc-c',
      code: 'ASSY',
      name: 'Assembly',
      alternative_work_center_ids: [],
      buckets: [],
      blocks: [],
    },
  ],
};
