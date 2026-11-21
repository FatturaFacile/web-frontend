/** Lifecycle state of a phase (Italian: fase di lavorazione) on the MES operator board. */
export type MesPhaseStatus = 'available' | 'assigned' | 'setup' | 'running' | 'suspended' | 'closed';

/** Operator actions of the phase state machine; the API returns the ones allowed in the current state. */
export type MesAction =
  | 'take_over'
  | 'start_setup'
  | 'start_production'
  | 'suspend'
  | 'resume'
  | 'declare_production'
  | 'consume_material'
  | 'close';

/** Whether the operator attends the machine while it runs. */
export type MesMachineMode = 'attended' | 'unattended';

export const MES_SUSPENSION_REASONS = [
  'machine_breakdown',
  'material_shortage',
  'quality_hold',
  'break',
  'shift_handover',
  'tool_change',
  'other',
] as const;
export type MesSuspensionReason = (typeof MES_SUSPENSION_REASONS)[number];

export const MES_DEFECT_REASONS = [
  'dimensional',
  'surface',
  'material_defect',
  'tool_wear',
  'setup_error',
  'operator_error',
  'machine_fault',
  'other',
] as const;
export type MesDefectReason = (typeof MES_DEFECT_REASONS)[number];

/** Time category of an interval. */
export type MesTimeCategory = 'setup' | 'run' | 'suspension';

/** Accumulated times of a phase, in seconds computed by the server as of `server_time`. */
export interface MesTimes {
  setup_seconds: number;
  run_seconds: number;
  attended_run_seconds: number;
  unattended_run_seconds: number;
  downtime_seconds: number;
  man_seconds: number;
  machine_seconds: number;
  setup_minutes: string;
  run_minutes: string;
  downtime_minutes: string;
  man_minutes: string;
  machine_minutes: string;
  man_seconds_by_operator: Record<string, number>;
  downtime_seconds_by_reason: Record<string, number>;
}

export interface MesOpenInterval {
  category: MesTimeCategory;
  started_at: string;
  machine_attended: boolean;
  suspension_reason: MesSuspensionReason | null;
}

/** A component of the production order, for the lot registration. */
export interface MesComponent {
  mfg_item_id: string;
  item_code: string | null;
  item_name: string | null;
  required_quantity: string;
  consumed_quantity: string;
  lot_tracked: boolean;
}

/** One row of the board: a phase, or an operation nobody took over yet (`id` null, status `available`). */
export interface MesPhase {
  id: string | null;
  version: number;
  status: MesPhaseStatus;
  allowed_actions: MesAction[];
  resume_to: MesPhaseStatus | null;
  machine_mode: MesMachineMode;
  operator_id: string | null;
  machine_id: string | null;
  work_center_id: string;
  production_order: {
    id: string;
    order_number: string | null;
    item_code: string | null;
    item_name: string | null;
    target_quantity: string | null;
  };
  operation: {
    id: string;
    sequence: number;
    name: string | null;
    completed_quantity: string;
    scrapped_quantity: string;
  };
  open_interval: MesOpenInterval | null;
  times: MesTimes;
  declared: { good_quantity: string; scrap_quantity: string };
  consumptions_count: number;
  components?: MesComponent[];
  taken_over_at: string | null;
  closed_at: string | null;
  server_time: string;
}

export interface MesBoard {
  server_time: string;
  work_center: { id: string; code: string; name: string };
  phases: MesPhase[];
  available: MesPhase[];
}

/** Times shown on the counters, in seconds, already advanced to the current instant. */
export interface MesLiveTimes {
  setup: number;
  run: number;
  downtime: number;
  man: number;
  machine: number;
}

/** Fields every command carries. */
export interface MesCommandMeta {
  idempotency_key: string;
  expected_version?: number;
  occurred_at?: string;
}

export interface MesTraceability {
  phase: MesPhase;
  intervals: {
    category: MesTimeCategory;
    operator_id: string | null;
    machine_attended: boolean;
    suspension_reason: MesSuspensionReason | null;
    started_at: string;
    ended_at: string | null;
  }[];
  declarations: { id: string; operator_id: string | null; good_quantity: string; scrap_quantity: string; declared_at: string }[];
  scraps: { production_declaration_id: string; quantity: string; defect_reason: MesDefectReason; note: string | null }[];
  materials: {
    id: string;
    mfg_item_id: string;
    item_code: string | null;
    lot_code: string | null;
    quantity: string;
    operator_id: string | null;
    consumed_at: string;
  }[];
}
