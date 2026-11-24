import { Pipe, PipeTransform } from '@angular/core';

function readPath(row: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((value, key) => (value as Record<string, unknown> | null | undefined)?.[key], row);
}

/** Value list of a column filter: `'status' | gridFilterList: table.nzData` (distinct values, max 30). */
@Pipe({ name: 'gridFilterList' })
export class GridFilterListPipe implements PipeTransform {
  transform(path: string, rows: readonly unknown[] | null | undefined): { text: string; value: string }[] {
    const distinct = new Set<string>();
    for (const row of rows ?? []) {
      const value = readPath(row, path);
      if (value === null || value === undefined || value === '' || typeof value === 'object') {
        continue;
      }
      distinct.add(String(value));
      if (distinct.size > 30) {
        return [];
      }
    }
    return [...distinct]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((value) => ({ text: value, value }));
  }
}

/** Predicate of a column filter for `[nzFilterFn]`. */
@Pipe({ name: 'gridFilterFn' })
export class GridFilterFnPipe implements PipeTransform {
  transform(path: string): (selected: string[], row: unknown) => boolean {
    return (selected, row) => {
      const value = readPath(row, path);
      return selected.length === 0 || selected.includes(value === null || value === undefined ? '' : String(value));
    };
  }
}
