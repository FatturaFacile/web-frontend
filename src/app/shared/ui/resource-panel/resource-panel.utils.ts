import { ResourceField, ResourceRow } from './resource-panel.types';

/** Value at a dotted path (`warehouse.name`) of a record. */
export function getByPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Fills the `{placeholders}` of a path from the given sources (first match wins). */
export function resolvePath(path: string, ...sources: (Record<string, unknown> | null | undefined)[]): string {
  return path.replace(/\{(\w+)\}/g, (_match, name: string) => {
    for (const source of sources) {
      const value = source?.[name];
      if (value !== undefined && value !== null && value !== '') {
        return encodeURIComponent(String(value));
      }
    }
    return '';
  });
}

/** Maps placeholders named like `variantId` / `orderId` to the id of the row when the row has no such key. */
export function rowIdAliases(path: string, row: ResourceRow | null): Record<string, unknown> {
  const aliases: Record<string, unknown> = {};
  for (const match of path.matchAll(/\{(\w+Id)\}/g)) {
    aliases[match[1]] = row?.['id'];
  }
  return aliases;
}

/** True when every placeholder of the path can be resolved. */
export function isPathResolvable(path: string, ...sources: (Record<string, unknown> | null | undefined)[]): boolean {
  return [...path.matchAll(/\{(\w+)\}/g)].every((match) =>
    sources.some((source) => {
      const value = source?.[match[1]];
      return value !== undefined && value !== null && value !== '';
    }),
  );
}

/** `fully_received` -> `Fully received`, used when no translation exists. */
export function humanize(value: string): string {
  const spaced = value.replace(/[_.-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function toIsoDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

/**
 * Turns the raw form value into the request body: blanks are dropped, decimals stay strings,
 * `json` fields are parsed, `datetime-local` values get seconds and `lines` are cleaned recursively.
 */
export function buildRequestBody(fields: readonly ResourceField[], value: ResourceRow): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = value[field.key];
    if (field.type === 'switch') {
      body[field.key] = raw === true;
      continue;
    }
    if (isBlank(raw)) {
      continue;
    }
    switch (field.type) {
      case 'json':
        body[field.key] = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
        break;
      case 'datetime':
        body[field.key] = toIsoDateTime(String(raw));
        break;
      case 'integer':
        body[field.key] = Number(raw);
        break;
      case 'lines': {
        const lines = (Array.isArray(raw) ? raw : []).map((line) =>
          buildRequestBody(field.fields ?? [], line as ResourceRow),
        );
        body[field.key] = lines.filter((line) => Object.keys(line).length > 0);
        break;
      }
      default:
        body[field.key] = raw;
    }
  }
  return body;
}

/** Initial form value of a field list, optionally pre-filled from a row. */
export function initialFormValue(fields: readonly ResourceField[], row?: ResourceRow): ResourceRow {
  const value: ResourceRow = {};
  for (const field of fields) {
    const fromRow = row ? row[field.key] : undefined;
    if (field.type === 'switch') {
      value[field.key] = typeof fromRow === 'boolean' ? fromRow : (field.defaultValue as boolean | undefined) ?? false;
    } else if (field.type === 'json') {
      value[field.key] = fromRow === undefined || fromRow === null ? '' : JSON.stringify(fromRow);
    } else if (field.type === 'datetime' && typeof fromRow === 'string') {
      value[field.key] = fromRow.slice(0, 16);
    } else if (field.type === 'date' && typeof fromRow === 'string') {
      value[field.key] = fromRow.slice(0, 10);
    } else if (field.type === 'lines') {
      value[field.key] = Array.isArray(fromRow) ? fromRow : [];
    } else if (fromRow !== undefined && fromRow !== null) {
      value[field.key] = fromRow;
    } else {
      value[field.key] = field.defaultValue ?? (field.type === 'tags' || field.type === 'multiselect' ? [] : '');
    }
  }
  return value;
}
