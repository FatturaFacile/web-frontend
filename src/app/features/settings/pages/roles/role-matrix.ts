import type { PermissionCatalog } from '@core';

/** Columns of the role matrix, in display order: the standard actions first, then the domain ones. */
export const MATRIX_ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'export',
  'approve',
  'post',
  'cancel',
  'send_sdi',
  'view_sensitive',
] as const;

export type TriState = 'all' | 'some' | 'none';

export interface MatrixRow {
  module: string;
  resource: string;
  /** Actions the catalog offers for the resource. */
  actions: readonly string[];
}

/** One row per module and resource, sorted, from the permission catalog of the API. */
export function buildRows(catalog: PermissionCatalog): MatrixRow[] {
  return Object.keys(catalog)
    .sort()
    .flatMap((module) =>
      Object.keys(catalog[module])
        .sort()
        .map((resource) => ({ module, resource, actions: catalog[module][resource] })),
    );
}

/** The columns that at least one row uses. */
export function usedActions(rows: readonly MatrixRow[]): string[] {
  return MATRIX_ACTIONS.filter((action) => rows.some((row) => row.actions.includes(action)));
}

export const permissionKey = (row: MatrixRow, action: string): string => `${row.module}.${row.resource}.${action}`;

function state(total: number, on: number): TriState {
  return total === 0 || on === 0 ? 'none' : on === total ? 'all' : 'some';
}

export function rowState(row: MatrixRow, selected: ReadonlySet<string>): TriState {
  return state(row.actions.length, row.actions.filter((a) => selected.has(permissionKey(row, a))).length);
}

export function columnState(rows: readonly MatrixRow[], action: string, selected: ReadonlySet<string>): TriState {
  const cells = rows.filter((row) => row.actions.includes(action));
  return state(cells.length, cells.filter((row) => selected.has(permissionKey(row, action))).length);
}

export function toggleCell(selected: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(selected);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
}

/** Turns a whole row on (or off); `some` becomes `all`, like a native tri-state checkbox. */
export function toggleRow(row: MatrixRow, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  const turnOn = rowState(row, selected) !== 'all';
  for (const action of row.actions) {
    if (turnOn) {
      next.add(permissionKey(row, action));
    } else {
      next.delete(permissionKey(row, action));
    }
  }
  return next;
}

export function toggleColumn(rows: readonly MatrixRow[], action: string, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  const turnOn = columnState(rows, action, selected) !== 'all';
  for (const row of rows.filter((r) => r.actions.includes(action))) {
    if (turnOn) {
      next.add(permissionKey(row, action));
    } else {
      next.delete(permissionKey(row, action));
    }
  }
  return next;
}
