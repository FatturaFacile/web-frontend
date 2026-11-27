import { HttpErrorResponse } from '@angular/common/http';
import {
  SctComponent,
  SctDeadlineStatus,
  SctDirection,
  SctMovementType,
  SctOrder,
  SctOrderPayload,
  SctProblem,
  SctStatus,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): production, procurement and operations plan; finance reads and exports. */
export const SUBCONTRACTING_MODULE = 'subcontracting';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and the field errors of a 422. */
export interface SctOutcome {
  ok: boolean;
  /** Translation key of the refusal (`subcontracting.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const SCT_OK: SctOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
};

export function errorKey(code: string | null | undefined): string {
  return `subcontracting.error.${code ? code : 'generic'}`;
}

export function problemOf(error: unknown): SctProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as SctProblem) : null;
}

function scalarParams(params: Record<string, unknown> | undefined): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): SctOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    code: problem?.code ?? null,
    detail: first ?? problem?.detail ?? null,
    params: scalarParams(problem?.params),
    errors,
  };
}

// --- Colours of the badges ---

const STATUS_COLORS: Record<SctStatus, string> = {
  draft: 'default',
  confirmed: 'blue',
  materials_dispatched: 'cyan',
  in_progress: 'geekblue',
  partially_returned: 'gold',
  completed: 'green',
  cancelled: 'red',
};

export function statusColor(status: SctStatus): string {
  return STATUS_COLORS[status] ?? 'default';
}

const DEADLINE_COLORS: Record<SctDeadlineStatus, string> = {
  ok: 'green',
  warning: 'orange',
  expired: 'red',
  closed: 'default',
};

/** Green within the year, orange in the last 30 days, red once the one-year return deadline is over. */
export function deadlineColor(status: SctDeadlineStatus): string {
  return DEADLINE_COLORS[status] ?? 'default';
}

export function directionColor(direction: SctDirection): string {
  return direction === 'passive' ? 'blue' : 'purple';
}

const MOVEMENT_COLORS: Record<SctMovementType, string> = {
  outbound_dispatch: 'blue',
  inbound_consumption_backflush: 'green',
  scrap_declared: 'volcano',
  unused_material_return: 'gold',
  customer_material_receipt: 'purple',
  customer_finished_return: 'geekblue',
};

export function movementColor(movement: SctMovementType): string {
  return MOVEMENT_COLORS[movement] ?? 'default';
}

/** The countdown of a statutory deadline as a key of the dictionary with its `{days}` parameter. */
export function countdownOf(daysToDeadline: number | null): { key: string; days: number } | null {
  if (daysToDeadline === null) {
    return null;
  }
  return daysToDeadline < 0
    ? { key: 'subcontracting.countdown.late', days: Math.abs(daysToDeadline) }
    : { key: 'subcontracting.countdown.left', days: daysToDeadline };
}

// --- Actions available on an order ---

export type SctAction =
  | 'confirm'
  | 'cancel'
  | 'dispatch'
  | 'receive'
  | 'returnUnused'
  | 'receiveMaterials'
  | 'produce'
  | 'deliver';

function positive(value: string | number | null | undefined): boolean {
  return Number(value ?? 0) > 0;
}

/**
 * The actions an order offers in its status, with the same rules as the API: nothing before the confirmation, material in or out while
 * something is left to move, the receipt and the return while goods are at the partner.
 */
export function availableActions(order: SctOrder): SctAction[] {
  const components: SctComponent[] = order.components ?? [];
  const toDispatch = components.some((c) => positive(c.to_dispatch_qty));
  const held = components.some((c) => positive(c.held_qty));

  switch (order.status) {
    case 'draft':
      return ['confirm', 'cancel'];
    case 'confirmed':
      return order.direction === 'passive' ? ['dispatch', 'cancel'] : ['receiveMaterials', 'cancel'];
    case 'materials_dispatched':
    case 'in_progress':
    case 'partially_returned':
      break;
    default:
      return [];
  }

  if (order.direction === 'passive') {
    const actions: SctAction[] = [];
    if (toDispatch) {
      actions.push('dispatch');
    }
    if (held && positive(order.open_quantity)) {
      actions.push('receive');
    }
    if (held) {
      actions.push('returnUnused');
    }
    return actions;
  }

  const actions: SctAction[] = [];
  if (toDispatch) {
    actions.push('receiveMaterials');
  }
  if (held && positive(order.open_quantity)) {
    actions.push('produce');
  }
  if (positive(order.received_quantity) && Number(order.received_quantity) > Number(order.delivered_quantity)) {
    actions.push('deliver');
  } else if (held) {
    actions.push('deliver');
  }
  return actions;
}

// --- Order form ---

export interface SctComponentRow {
  component_product_id: string | null;
  required_qty_per_unit: number | null;
  unit_of_measure: string;
}

/** The fields of the creation wizard. */
export interface SctOrderForm {
  direction: SctDirection;
  subcontracting_type: 'full_bom' | 'single_operation';
  partner_id: string | null;
  output_product_id: string | null;
  planned_quantity: number | null;
  unit_service_cost: number | null;
  currency: string;
  expected_return_date: Date | null;
  bom_id: string | null;
  linked_production_order_id: string | null;
  routing_operation_label: string;
  source_warehouse_id: string | null;
  customs_regime: 'none' | 'tpp_outward_processing' | 'tpa_inward_processing';
  generate_service_purchase_order: boolean;
  notes: string;
  components: SctComponentRow[];
}

export function emptyOrderForm(): SctOrderForm {
  return {
    direction: 'passive',
    subcontracting_type: 'full_bom',
    partner_id: null,
    output_product_id: null,
    planned_quantity: null,
    unit_service_cost: null,
    currency: 'EUR',
    expected_return_date: null,
    bom_id: null,
    linked_production_order_id: null,
    routing_operation_label: '',
    source_warehouse_id: null,
    customs_regime: 'none',
    generate_service_purchase_order: false,
    notes: '',
    components: [],
  };
}

/** `2026-07-04` of a date picked in the form, in local time (the API takes a calendar day). */
export function isoDay(date: Date | null): string | null {
  if (date === null) {
    return null;
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The customs regimes an order direction can use: TPP is passive processing, TPA active. */
export function regimesFor(direction: SctDirection): SctOrderForm['customs_regime'][] {
  return direction === 'passive'
    ? ['none', 'tpp_outward_processing']
    : ['none', 'tpa_inward_processing'];
}

/** Whether the wizard can leave a step: what the step asks for is filled in. */
export function stepIsValid(step: number, form: SctOrderForm): boolean {
  switch (step) {
    case 0:
      return (
        form.partner_id !== null &&
        form.output_product_id !== null &&
        (form.planned_quantity ?? 0) > 0
      );
    case 1:
      return true;
    case 2:
      return (
        form.bom_id !== null ||
        (form.components.length > 0 &&
          form.components.every(
            (row) => row.component_product_id !== null && (row.required_qty_per_unit ?? 0) > 0,
          ))
      );
    default:
      return true;
  }
}

/** The request body of a form: empty fields are left out, the BOM wins over the lines when it is chosen. */
export function buildOrderPayload(form: SctOrderForm): SctOrderPayload {
  const payload: SctOrderPayload = {
    direction: form.direction,
    subcontracting_type: form.subcontracting_type,
    partner_id: form.partner_id ?? '',
    output_product_id: form.output_product_id ?? '',
    planned_quantity: String(form.planned_quantity ?? 0),
    unit_service_cost: String(form.unit_service_cost ?? 0),
    currency: form.currency.toUpperCase(),
    customs_regime: form.customs_regime,
  };

  const optional: Partial<SctOrderPayload> = {
    expected_return_date: isoDay(form.expected_return_date),
    bom_id: form.bom_id,
    linked_production_order_id: form.linked_production_order_id,
    routing_operation_label: form.routing_operation_label.trim() || null,
    source_warehouse_id: form.source_warehouse_id,
    notes: form.notes.trim() || null,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined) {
      (payload as unknown as Record<string, unknown>)[key] = value;
    }
  }

  if (form.direction === 'passive' && form.generate_service_purchase_order) {
    payload.generate_service_purchase_order = true;
  }

  if (form.bom_id === null) {
    payload.components = form.components
      .filter((row) => row.component_product_id !== null)
      .map((row) => ({
        component_product_id: row.component_product_id as string,
        required_qty_per_unit: String(row.required_qty_per_unit ?? 0),
        unit_of_measure: row.unit_of_measure || 'PCS',
      }));
  }

  return payload;
}

/** The quantity of a component line a plan needs for a number of units: preview only, the API computes the real one. */
export function plannedFor(perUnit: number | null, units: number | null): number {
  return Math.round((perUnit ?? 0) * (units ?? 0) * 10_000) / 10_000;
}

/** Percentage of the planned quantity already received (passive) or delivered (active), 0-100. */
export function progressOf(order: SctOrder): number {
  const planned = Number(order.planned_quantity);
  if (planned <= 0) {
    return 0;
  }
  const done = Number(order.direction === 'active' ? order.delivered_quantity : order.received_quantity);
  return Math.min(100, Math.round(((done + Number(order.scrap_quantity)) / planned) * 100));
}

// --- Files ---

/** Saves a downloaded file through a temporary link. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function registerFilename(format: string, today: Date = new Date()): string {
  return `registro-conto-lavoro-${isoDay(today)}.${format}`;
}
