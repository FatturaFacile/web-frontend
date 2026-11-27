import { HttpErrorResponse } from '@angular/common/http';
import { ObsHistoryStatus, ObsPlanNode, ObsSlowQuery } from '../../core/models/observability.model';

/** Ant Design colour of the badge of a status (the same for connectors and for the history bars). */
const STATUS_COLORS: Record<ObsHistoryStatus, string> = {
  operational: 'green',
  degraded: 'gold',
  outage: 'red',
  maintenance: 'blue',
  unknown: 'default',
};

export function statusColor(status: ObsHistoryStatus): string {
  return STATUS_COLORS[status] ?? 'default';
}

/** Translation key of a status code (`OBSERVABILITY.STATUS.OPERATIONAL`). */
export function statusKey(status: ObsHistoryStatus): string {
  return `OBSERVABILITY.STATUS.${status.toUpperCase()}`;
}

/** Translation key of the error of a failed call: 403 means the user is not a platform administrator. */
export function failureKey(error: unknown): string {
  if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 401)) {
    return 'OBSERVABILITY.ERROR.FORBIDDEN';
  }
  return 'OBSERVABILITY.ERROR.GENERIC';
}

/** Milliseconds as shown in the tables: one decimal below 100 ms, none above; a dash when unknown. */
export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value < 100 ? value.toFixed(1) : Math.round(value).toString();
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(digits)}%`;
}

/** Colour of a latency against the p95 alert threshold: red above it, gold above half of it. */
export function latencyColor(valueMs: number, thresholdMs: number): string {
  if (valueMs >= thresholdMs) {
    return 'red';
  }
  return valueMs >= thresholdMs / 2 ? 'gold' : 'default';
}

export interface PlanRow {
  id: number;
  depth: number;
  nodeType: string;
  target: string | null;
  cost: number | null;
  rows: number | null;
  filter: string | null;
  /** A sequential scan: the node the missing-index advice is about. */
  seqScan: boolean;
}

/** The root node of an EXPLAIN (FORMAT JSON) answer, whatever the wrapping (`[{Plan}]`, `{Plan}` or the node itself). */
export function rootPlanNode(plan: ObsSlowQuery['plan']): ObsPlanNode | null {
  if (plan === null || plan === undefined) {
    return null;
  }
  const first = Array.isArray(plan) ? plan[0] : plan;
  if (!first || typeof first !== 'object') {
    return null;
  }
  const candidate = (first as { Plan?: ObsPlanNode }).Plan;
  return candidate ?? (first as ObsPlanNode);
}

/** The plan flattened depth-first, ready to render as an indented list. */
export function flattenPlan(plan: ObsSlowQuery['plan']): PlanRow[] {
  const root = rootPlanNode(plan);
  const rows: PlanRow[] = [];
  const walk = (node: ObsPlanNode, depth: number): void => {
    const nodeType = node['Node Type'] ?? '';
    rows.push({
      id: rows.length,
      depth,
      nodeType,
      target: node['Relation Name'] ?? node['Index Name'] ?? null,
      cost: typeof node['Total Cost'] === 'number' ? node['Total Cost'] : null,
      rows: typeof node['Plan Rows'] === 'number' ? node['Plan Rows'] : null,
      filter: typeof node.Filter === 'string' ? node.Filter : null,
      seqScan: nodeType === 'Seq Scan',
    });
    for (const child of node.Plans ?? []) {
      walk(child, depth + 1);
    }
  };
  if (root) {
    walk(root, 0);
  }
  return rows;
}

/** Copies text to the clipboard; false when the browser refuses (no permission or no secure context). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A stable signature of the connectors that are not operational: the banner stays dismissed until it changes. */
export function statusSignature(
  connectors: readonly { key: string; status: ObsHistoryStatus }[],
): string {
  return connectors
    .filter((connector) => connector.status !== 'operational')
    .map((connector) => `${connector.key}:${connector.status}`)
    .sort()
    .join('|');
}
