import { DiffModified, DiffSet, RevisionDiff } from './cpq-quotes.models';

export interface DiffChange {
  field: string;
  from: string;
  to: string;
}

export interface DiffRow {
  kind: 'added' | 'removed' | 'modified';
  scope: 'SECTION' | 'LINE';
  label: string;
  changes: DiffChange[];
}

export function formatChange(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }
  return String(value);
}

function rowsOf(
  set: DiffSet,
  scope: DiffRow['scope'],
  labelOf: (row: Record<string, unknown>) => string,
): DiffRow[] {
  const modified = set.modified.map((m: DiffModified): DiffRow => ({
    kind: 'modified',
    scope,
    label: m.label,
    changes: Object.entries(m.changes).map(([field, change]) => ({
      field,
      from: formatChange(change.from),
      to: formatChange(change.to),
    })),
  }));

  return [
    ...set.added.map((row): DiffRow => ({
      kind: 'added',
      scope,
      label: labelOf(row),
      changes: [],
    })),
    ...set.removed.map((row): DiffRow => ({
      kind: 'removed',
      scope,
      label: labelOf(row),
      changes: [],
    })),
    ...modified,
  ];
}

/** Flattens the structural diff into display rows: sections first, then lines; added, removed, modified. */
export function diffRows(diff: RevisionDiff): DiffRow[] {
  return [
    ...rowsOf(diff.sections, 'SECTION', (row) => String(row['title'] ?? '')),
    ...rowsOf(diff.lines, 'LINE', (row) => String(row['description'] ?? '')),
  ];
}
