import { MfgBomResource } from './manufacturing.model';

/** Mod 060: multi-level BOM management. Decimals (quantities, percentages) arrive from the API as strings. */

/** Issue method of a component line; the backend accepts the order-close variant since Mod 060. */
export type BomIssueMethod = 'manual' | 'backflush' | 'backflush_order_close';
export type BomChangeAction = 'add' | 'update' | 'remove';

export interface BomComponentChange {
  action: BomChangeAction;
  component_item_id: string;
  quantity_per?: string | number | null;
  scrap_percentage?: string | number | null;
  yield_percentage?: string | number | null;
  fixed_scrap_quantity?: string | number | null;
  substitute_item_ids?: string[];
  is_phantom?: boolean;
  issue_method?: BomIssueMethod;
  operation_sequence?: number | null;
  sequence?: number | null;
}

export interface BomRevisionPayload {
  source_bom_id?: string;
  reason?: string;
  mfg_item_id?: string;
  name?: string;
  components: BomComponentChange[];
}

export interface BomDiffEntry {
  component_item_id?: string;
  item_code?: string;
  item_name?: string;
  quantity_per?: string;
  [key: string]: unknown;
}

export interface BomDiffModified {
  component_item_id?: string;
  item_code?: string;
  item_name?: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface BomDiffResult {
  added: BomDiffEntry[];
  removed: BomDiffEntry[];
  modified: BomDiffModified[];
  summary?: Record<string, number> | string | null;
}

export interface EngineeringChangeResource {
  id: string;
  eco_number?: string;
  title?: string;
  status: string;
  reason?: string | null;
  diff_payload?: BomDiffResult | null;
  [key: string]: unknown;
}

export interface BomRevisionResult {
  data: MfgBomResource;
  engineering_change?: EngineeringChangeResource;
}

export interface BomExplosionLine {
  level: number;
  item_id?: string;
  item_code: string;
  item_name?: string;
  uom?: string;
  net_quantity: string;
  variable_waste_quantity: string;
  fixed_waste_quantity: string;
  effective_quantity: string;
  is_phantom: boolean;
  via_phantom?: boolean;
  has_bom: boolean;
  lead_time_offset_days?: number;
  unit_cost?: string | null;
  path: string[] | string;
  component_id?: string;
  sequence?: number | null;
}

export interface BomExplosion {
  total_lead_time_days: number;
  lines: BomExplosionLine[];
}

export interface BomExplosionParams {
  quantity?: number | string;
  date?: string;
  multi_level?: boolean;
  flatten_phantoms?: boolean;
}

export interface BomImplosionParent {
  level: number;
  parent_item_code: string;
  parent_item_name?: string;
  cumulative_coefficient: string;
  is_top_level: boolean;
  path: string[] | string;
}

export interface BomImplosion {
  parents: BomImplosionParent[];
  top_level: unknown[];
}

export interface BomMassReplacePayload {
  obsolete_item_id: string;
  substitute_item_id: string;
  reason: string;
  effective_from?: string | null;
  dry_run: boolean;
}

export interface BomMassReplaceEntry {
  bom_id?: string;
  bom_number?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface BomMassReplaceResult {
  replaced: BomMassReplaceEntry[];
  skipped: BomMassReplaceEntry[];
}

export interface BomImportRow {
  item_code: string;
  quantity_per: string | number;
  uom?: string | null;
  scrap_percentage?: string | number | null;
  yield_percentage?: string | number | null;
  fixed_scrap_quantity?: string | number | null;
  operation_sequence?: number | string | null;
  notes?: string | null;
}

export interface BomImportPayload {
  product_code: string;
  name: string;
  dry_run: boolean;
  rows: BomImportRow[];
}

export interface BomImportRowReport {
  line: number;
  status: string;
  errors: string[];
}

export interface BomImportReport {
  valid: boolean;
  rows: BomImportRowReport[];
  components?: unknown[];
  summary?: Record<string, unknown> | string | null;
}

export interface BomCoProductPayload {
  co_products: {
    item_id: string;
    quantity_per: string | number;
    cost_allocation_percentage?: string | number | null;
  }[];
}

export interface BomCostAllocation {
  allocations?: {
    item_code?: string;
    item_name?: string;
    allocation_percentage?: string;
    allocated_cost?: string;
  }[];
  total_cost?: string;
  [key: string]: unknown;
}

/** EUR.1 preferential-origin result. */
export interface BomPreferentialOrigin {
  qualifies: boolean;
  non_originating_percentage?: string;
  threshold_percentage?: string;
  origin_criterion?: string | null;
  [key: string]: unknown;
}

/** Minimal shape of an item-master row, enough for pickers. */
export interface MfgItemSummary {
  id: string;
  item_code: string;
  name: string;
  uom?: string | null;
}
