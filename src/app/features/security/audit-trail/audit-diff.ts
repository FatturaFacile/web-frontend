export type AuditDiffKind = 'added' | 'modified' | 'removed' | 'unchanged';

export interface AuditDiffRow {
  field: string;
  before: string | null;
  after: string | null;
  kind: AuditDiffKind;
}

function show(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return 'null';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Field by field comparison of the before and after values of a record. A field only in `after` is added, only in
 * `before` removed, in both with different values modified. Fields come out in alphabetical order.
 */
export function diffAuditValues(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditDiffRow[] {
  const oldValues = before ?? {};
  const newValues = after ?? {};
  const fields = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])].sort();

  return fields.map((field) => {
    const inBefore = field in oldValues;
    const inAfter = field in newValues;
    const oldText = show(oldValues[field]);
    const newText = show(newValues[field]);
    let kind: AuditDiffKind = 'unchanged';

    if (inBefore && !inAfter) {
      kind = 'removed';
    } else if (!inBefore && inAfter) {
      kind = 'added';
    } else if (oldText !== newText) {
      kind = 'modified';
    }

    return { field, before: oldText, after: newText, kind };
  });
}
